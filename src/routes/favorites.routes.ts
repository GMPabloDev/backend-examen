import { Hono } from "hono";
import { db } from "../db";
import {
  favorites,
  listings,
  agencies,
  users,
  listingImages,
} from "../db/schema";
import { eq, desc, count, and, sql, or, asc } from "drizzle-orm";
import { toggleFavoriteSchema } from "../validations/favorite.schema";

const favoritesRoutes = new Hono();

favoritesRoutes.get("/", async (c) => {
  const user = c.get("user") as { id: number };
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;
  const type = c.req.query("type");

  const conditions = [eq(favorites.userId, user.id)];
  if (type === "listings")
    conditions.push(sql`${favorites.listingId} IS NOT NULL`);
  if (type === "agencies")
    conditions.push(sql`${favorites.agencyId} IS NOT NULL`);

  const favoriteList = await db
    .select({
      id: favorites.id,
      createdAt: favorites.createdAt,
      listing: sql`
      CASE WHEN ${favorites.listingId} IS NOT NULL THEN (
        SELECT json_build_object(
          'id', listings.id,
          'title', listings.title,
          'price', listings.price,
          'priceType', listings.price_type,
          'propertyType', listings.property_type,
          'city', listings.city,
          'bedrooms', listings.bedrooms,
          'bathrooms', listings.bathrooms,
          'area', listings.area,
          'firstImage', (SELECT url FROM listing_images WHERE listing_id = listings.id ORDER BY "order" ASC LIMIT 1),
          'agency', CASE WHEN listings.agency_id IS NOT NULL THEN json_build_object('id', agencies.id, 'name', agencies.name, 'logo', agencies.logo)
                        ELSE NULL END,
          'user', CASE WHEN listings.user_id IS NOT NULL THEN json_build_object('id', users.id, 'name', users.name, 'avatarUrl', users.avatar_url)
                       ELSE NULL END
        )
        FROM listings
        LEFT JOIN agencies ON listings.agency_id = agencies.id
        LEFT JOIN users ON listings.user_id = users.id
        WHERE listings.id = ${favorites.listingId}
      )
      ELSE NULL END
    `,
      agency: sql`
      CASE WHEN ${favorites.agencyId} IS NOT NULL THEN (
        SELECT json_build_object(
          'id', agencies.id,
          'name', agencies.name,
          'email', agencies.email,
          'phone', agencies.phone,
          'logo', agencies.logo,
          'website', agencies.website,
          'description', agencies.description,
          'owner', CASE WHEN agencies.owner_id IS NOT NULL THEN json_build_object('id', users.id, 'name', users.name, 'avatarUrl', users.avatar_url)
                        ELSE NULL END,
          'listingCount', (SELECT COUNT(*) FROM listings WHERE agency_id = agencies.id)
        )
        FROM agencies
        LEFT JOIN users ON agencies.owner_id = users.id
        WHERE agencies.id = ${favorites.agencyId}
      )
      ELSE NULL END
    `,
    })
    .from(favorites)
    .where(and(...conditions))
    .orderBy(desc(favorites.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(favorites)
    .where(and(...conditions));

  return c.json({
    favorites: favoriteList.map((f) => ({
      ...f,
      listing: f.listing
        ? typeof f.listing === "string"
          ? JSON.parse(f.listing)
          : f.listing
        : null,
      agency: f.agency
        ? typeof f.agency === "string"
          ? JSON.parse(f.agency)
          : f.agency
        : null,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

favoritesRoutes.get("/check", async (c) => {
  const user = c.get("user") as { id: number };
  const listingId = c.req.query("listingId");
  const agencyId = c.req.query("agencyId");

  if (!listingId && !agencyId) {
    return c.json({ error: "Debes proporcionar listingId o agencyId" }, 400);
  }

  const conditions = [eq(favorites.userId, user.id)];
  if (listingId) conditions.push(eq(favorites.listingId, parseInt(listingId)));
  if (agencyId) conditions.push(eq(favorites.agencyId, parseInt(agencyId)));

  const [favorite] = await db
    .select()
    .from(favorites)
    .where(and(...conditions))
    .limit(1);

  return c.json({ isFavorite: !!favorite, favorite });
});

favoritesRoutes.post("/toggle", async (c) => {
  const user = c.get("user") as { id: number };
  const body = await c.req.json();
  const validation = toggleFavoriteSchema.safeParse(body);

  if (!validation.success) {
    return c.json(
      { error: "Datos inválidos", details: validation.error.issues },
      400,
    );
  }

  const { listingId, agencyId } = validation.data;

  if (listingId) {
    const [listing] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);
    if (!listing) {
      return c.json({ error: "Anuncio no encontrado" }, 404);
    }
  }

  if (agencyId) {
    const [agency] = await db
      .select()
      .from(agencies)
      .where(eq(agencies.id, agencyId))
      .limit(1);
    if (!agency) {
      return c.json({ error: "Agencia no encontrada" }, 404);
    }
  }

  const conditions = [eq(favorites.userId, user.id)];
  if (listingId) conditions.push(eq(favorites.listingId, listingId));
  if (agencyId) conditions.push(eq(favorites.agencyId, agencyId));

  const [existingFavorite] = await db
    .select()
    .from(favorites)
    .where(and(...conditions))
    .limit(1);

  if (existingFavorite) {
    await db.delete(favorites).where(eq(favorites.id, existingFavorite.id));
    return c.json({ message: "Eliminado de favoritos", isFavorite: false });
  }

  const [favorite] = await db
    .insert(favorites)
    .values({
      userId: user.id,
      listingId: listingId || null,
      agencyId: agencyId || null,
    })
    .returning();

  return c.json(
    { message: "Agregado a favoritos", isFavorite: true, favorite },
    201,
  );
});

favoritesRoutes.delete("/:id", async (c) => {
  const user = c.get("user") as { id: number };
  const id = parseInt(c.req.param("id"));

  const [favorite] = await db
    .select()
    .from(favorites)
    .where(eq(favorites.id, id))
    .limit(1);
  if (!favorite) {
    return c.json({ error: "Favorito no encontrado" }, 404);
  }

  if (favorite.userId !== user.id) {
    return c.json(
      { error: "No tienes permiso para eliminar este favorito" },
      403,
    );
  }

  await db.delete(favorites).where(eq(favorites.id, id));

  return c.json({ message: "Eliminado de favoritos" });
});

export default favoritesRoutes;
