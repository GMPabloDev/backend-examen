import { Hono } from "hono";
import { db } from "../db";
import { listings, listingImages, agencies, users } from "../db/schema";
import {
  eq,
  desc,
  count,
  and,
  like,
  gte,
  lte,
  sql,
  or,
  asc,
} from "drizzle-orm";
import {
  createListingSchema,
  updateListingSchema,
} from "../validations/listing.schema";

const listingsRoutes = new Hono();

listingsRoutes.get("/", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  const conditions: any[] = [];

  if (c.req.query("status"))
    conditions.push(eq(listings.status, c.req.query("status") as any));
  if (c.req.query("priceType"))
    conditions.push(eq(listings.priceType, c.req.query("priceType") as any));
  if (c.req.query("propertyType"))
    conditions.push(
      eq(listings.propertyType, c.req.query("propertyType") as any),
    );
  if (c.req.query("city"))
    conditions.push(like(listings.city, `%${c.req.query("city")}%`));
  if (c.req.query("minPrice"))
    conditions.push(gte(listings.price, parseFloat(c.req.query("minPrice")!)));
  if (c.req.query("maxPrice"))
    conditions.push(lte(listings.price, parseFloat(c.req.query("maxPrice")!)));
  if (c.req.query("bedrooms"))
    conditions.push(gte(listings.bedrooms, parseInt(c.req.query("bedrooms")!)));
  if (c.req.query("featured"))
    conditions.push(eq(listings.featured, c.req.query("featured") === "true"));

  const sortField = c.req.query("sortBy") || "publishedAt";
  const sortOrder = c.req.query("sortOrder") === "asc" ? asc : desc;

  const listingList = await db
    .select({
      id: listings.id,
      title: listings.title,
      price: listings.price,
      priceType: listings.priceType,
      propertyType: listings.propertyType,
      city: listings.city,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      area: listings.area,
      status: listings.status,
      featured: listings.featured,
      createdAt: listings.publishedAt,
      firstImage: sql<string>`(SELECT url FROM listing_images WHERE listing_id = listings.id ORDER BY "order" ASC LIMIT 1)`,
      agency: {
        id: agencies.id,
        name: agencies.name,
        logo: agencies.logo,
      },
      user: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(listings)
    .leftJoin(agencies, eq(listings.agencyId, agencies.id))
    .leftJoin(users, eq(listings.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(listings.publishedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(listings)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return c.json({
    listings: listingList,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

listingsRoutes.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);

  if (!listing) {
    return c.json({ error: "Anuncio no encontrado" }, 404);
  }

  const images = await db
    .select()
    .from(listingImages)
    .where(eq(listingImages.listingId, id))
    .orderBy(asc(listingImages.order));

  const agency = listing.agencyId
    ? await db
        .select({
          id: agencies.id,
          name: agencies.name,
          email: agencies.email,
          phone: agencies.phone,
          logo: agencies.logo,
          website: agencies.website,
          owner: {
            id: users.id,
            name: users.name,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(agencies)
        .leftJoin(users, eq(agencies.ownerId, users.id))
        .where(eq(agencies.id, listing.agencyId!))
        .limit(1)
    : null;

  const user = listing.userId
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, listing.userId!))
        .limit(1)
    : null;

  await db
    .update(listings)
    .set({ views: listing.views + 1 })
    .where(eq(listings.id, id));

  const author = user
    ? { type: "PERSONA", ...user[0] }
    : agency
      ? { type: "AGENCIA", ...agency[0] }
      : null;

  return c.json({ listing: { ...listing, images }, author });
});

listingsRoutes.get("/my/listings", async (c) => {
  const user = c.get("user") as { id: number };
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  const listingList = await db
    .select({
      id: listings.id,
      title: listings.title,
      price: listings.price,
      priceType: listings.priceType,
      propertyType: listings.propertyType,
      city: listings.city,
      status: listings.status,
      createdAt: listings.publishedAt,
      firstImage: sql<string>`(SELECT url FROM listing_images WHERE listing_id = listings.id ORDER BY "order" ASC LIMIT 1)`,
      agency: {
        id: agencies.id,
        name: agencies.name,
      },
    })
    .from(listings)
    .leftJoin(agencies, eq(listings.agencyId, agencies.id))
    .where(eq(listings.userId, user.id))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(listings)
    .where(eq(listings.userId, user.id));

  return c.json({
    listings: listingList,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

listingsRoutes.get("/my/agency-listings", async (c) => {
  const user = c.get("user") as { id: number };
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  const userAgencies = await db
    .select({ id: agencies.id })
    .from(agencies)
    .where(eq(agencies.ownerId, user.id));
  const agencyIds = userAgencies.map((a) => a.id);

  if (agencyIds.length === 0) {
    return c.json({
      listings: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    });
  }

  const listingList = await db
    .select({
      id: listings.id,
      title: listings.title,
      price: listings.price,
      priceType: listings.priceType,
      propertyType: listings.propertyType,
      city: listings.city,
      status: listings.status,
      createdAt: listings.publishedAt,
      firstImage: sql<string>`(SELECT url FROM listing_images WHERE listing_id = listings.id ORDER BY "order" ASC LIMIT 1)`,
      agency: {
        id: agencies.id,
        name: agencies.name,
      },
    })
    .from(listings)
    .leftJoin(agencies, eq(listings.agencyId, agencies.id))
    .where(or(...agencyIds.map((id) => eq(listings.agencyId, id))))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(listings)
    .where(or(...agencyIds.map((id) => eq(listings.agencyId, id))));

  return c.json({
    listings: listingList,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

listingsRoutes.post("/", async (c) => {
  const user = c.get("user") as { id: number };
  const body = await c.req.json();
  const validation = createListingSchema.safeParse(body);

  if (!validation.success) {
    return c.json(
      { error: "Datos inválidos", details: validation.error.issues },
      400,
    );
  }

  const { images, agencyId, ...listingData } = validation.data;

  if (agencyId) {
    const [agency] = await db
      .select()
      .from(agencies)
      .where(eq(agencies.id, agencyId))
      .limit(1);
    if (!agency || agency.ownerId !== user.id) {
      return c.json(
        { error: "No tienes permiso para publicar en nombre de esta agencia" },
        403,
      );
    }
  }

  const [listing] = await db
    .insert(listings)
    .values({
      ...listingData,
      userId: agencyId ? null : user.id,
      agencyId: agencyId || null,
    })
    .returning();

  if (images && images.length > 0) {
    await db
      .insert(listingImages)
      .values(images.map((img) => ({ ...img, listingId: listing.id })));
  }

  const createdImages = await db
    .select()
    .from(listingImages)
    .where(eq(listingImages.listingId, listing.id));

  console.log({ images });
  console.log({ listing });

  return c.json(
    {
      message: "Anuncio creado exitosamente",
      listing: { ...listing, images: createdImages },
    },
    201,
  );
});

listingsRoutes.patch("/:id", async (c) => {
  const user = c.get("user") as { id: number };
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const validation = updateListingSchema.safeParse(body);

  if (!validation.success) {
    return c.json(
      { error: "Datos inválidos", details: validation.error.issues },
      400,
    );
  }

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  if (!listing) {
    return c.json({ error: "Anuncio no encontrado" }, 404);
  }

  const isOwner = listing.userId === user.id;
  if (!isOwner && listing.agencyId) {
    const [agency] = await db
      .select()
      .from(agencies)
      .where(eq(agencies.id, listing.agencyId))
      .limit(1);
    if (!agency || agency.ownerId !== user.id) {
      return c.json(
        { error: "No tienes permiso para editar este anuncio" },
        403,
      );
    }
  } else if (!isOwner) {
    return c.json({ error: "No tienes permiso para editar este anuncio" }, 403);
  }

  const { images, ...listingUpdateData } = validation.data;

  const [updatedListing] = await db
    .update(listings)
    .set(listingUpdateData)
    .where(eq(listings.id, id))
    .returning();

  if (images) {
    await db.delete(listingImages).where(eq(listingImages.listingId, id));
    if (images.length > 0) {
      await db
        .insert(listingImages)
        .values(images.map((img) => ({ ...img, listingId: id })));
    }
  }

  const updatedImages = await db
    .select()
    .from(listingImages)
    .where(eq(listingImages.listingId, id));

  return c.json({
    message: "Anuncio actualizado",
    listing: { ...updatedListing, images: updatedImages },
  });
});

listingsRoutes.patch("/:id/status", async (c) => {
  const user = c.get("user") as { id: number };
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const { status } = body;

  if (!["ACTIVO", "VENDIDO", "ALQUILADO", "PAUSADO"].includes(status)) {
    return c.json({ error: "Estado inválido" }, 400);
  }

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  if (!listing) {
    return c.json({ error: "Anuncio no encontrado" }, 404);
  }

  const isOwner = listing.userId === user.id;
  if (!isOwner && listing.agencyId) {
    const [agency] = await db
      .select()
      .from(agencies)
      .where(eq(agencies.id, listing.agencyId))
      .limit(1);
    if (!agency || agency.ownerId !== user.id) {
      return c.json(
        { error: "No tienes permiso para cambiar el estado de este anuncio" },
        403,
      );
    }
  } else if (!isOwner) {
    return c.json(
      { error: "No tienes permiso para cambiar el estado de este anuncio" },
      403,
    );
  }

  const [updatedListing] = await db
    .update(listings)
    .set({ status })
    .where(eq(listings.id, id))
    .returning();

  return c.json({ message: "Estado actualizado", listing: updatedListing });
});

listingsRoutes.delete("/:id", async (c) => {
  const user = c.get("user") as { id: number };
  const id = parseInt(c.req.param("id"));

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  if (!listing) {
    return c.json({ error: "Anuncio no encontrado" }, 404);
  }

  const isOwner = listing.userId === user.id;
  if (!isOwner && listing.agencyId) {
    const [agency] = await db
      .select()
      .from(agencies)
      .where(eq(agencies.id, listing.agencyId))
      .limit(1);
    if (!agency || agency.ownerId !== user.id) {
      return c.json(
        { error: "No tienes permiso para eliminar este anuncio" },
        403,
      );
    }
  } else if (!isOwner) {
    return c.json(
      { error: "No tienes permiso para eliminar este anuncio" },
      403,
    );
  }

  await db.delete(listings).where(eq(listings.id, id));

  return c.json({ message: "Anuncio eliminado" });
});

export default listingsRoutes;
