import { Hono } from "hono";
import { db } from "../db";
import { agencies, listings, users } from "../db/schema";
import { eq, desc, count, and, sql } from "drizzle-orm";
import {
  createAgencySchema,
  updateAgencySchema,
} from "../validations/agency.schema";

const agenciesRoutes = new Hono();

agenciesRoutes.get("/", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  const agencyList = await db
    .select({
      id: agencies.id,
      name: agencies.name,
      email: agencies.email,
      phone: agencies.phone,
      address: agencies.address,
      description: agencies.description,
      logo: agencies.logo,
      website: agencies.website,
      createdAt: agencies.createdAt,
      ownerId: agencies.ownerId,
      listingCount: count(listings.id),
    })
    .from(agencies)
    .leftJoin(
      listings,
      and(eq(listings.agencyId, agencies.id), eq(listings.status, "ACTIVO")),
    )
    .groupBy(agencies.id)
    .orderBy(desc(agencies.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(agencies);

  return c.json({
    agencies: agencyList,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

agenciesRoutes.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));

  const [agency] = await db
    .select()
    .from(agencies)
    .where(eq(agencies.id, id))
    .limit(1);

  if (!agency) {
    return c.json({ error: "Agencia no encontrada" }, 404);
  }

  const owner = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, agency.ownerId))
    .limit(1);

  const agencyListings = await db
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
      firstImage: sql<string>`(SELECT url FROM listing_images WHERE listing_id = listings.id ORDER BY \"order\" ASC LIMIT 1)`,
    })
    .from(listings)
    .where(and(eq(listings.agencyId, id), eq(listings.status, "ACTIVO")));

  const [{ listingCount }] = await db
    .select({ listingCount: count() })
    .from(listings)
    .where(eq(listings.agencyId, id));
  const [{ count: favoriteCount }] = await db
    .select({ count: count() })
    .from(sql`favorites`)
    .where(sql`agency_id = ${id}`);

  return c.json({
    agency: {
      ...agency,
      owner: owner[0],
      listings: agencyListings,
      _count: { listings: listingCount, favorites: favoriteCount },
    },
  });
});

agenciesRoutes.get("/my/owned", async (c) => {
  const user = c.get("user") as { id: number };

  const userAgencies = await db
    .select({
      id: agencies.id,
      name: agencies.name,
      email: agencies.email,
      phone: agencies.phone,
      address: agencies.address,
      description: agencies.description,
      logo: agencies.logo,
      website: agencies.website,
      createdAt: agencies.createdAt,
    })
    .from(agencies)
    .where(eq(agencies.ownerId, user.id));

  return c.json({ agencies: userAgencies, count: userAgencies.length });
});

agenciesRoutes.post("/", async (c) => {
  const user = c.get("user") as { id: number };
  const body = await c.req.json();
  const validation = createAgencySchema.safeParse(body);

  if (!validation.success) {
    return c.json(
      { error: "Datos inválidos", details: validation.error.issues },
      400,
    );
  }

  const [{ count: agencyCount }] = await db
    .select({ count: count() })
    .from(agencies)
    .where(eq(agencies.ownerId, user.id));
  if (agencyCount >= 2) {
    return c.json(
      { error: "Has alcanzado el límite máximo de 2 agencias por usuario" },
      400,
    );
  }

  const existingEmail = await db
    .select()
    .from(agencies)
    .where(eq(agencies.email, validation.data.email))
    .limit(1);
  if (existingEmail.length > 0) {
    return c.json({ error: "El email de agencia ya está registrado" }, 400);
  }

  const [agency] = await db
    .insert(agencies)
    .values({
      ...validation.data,
      ownerId: user.id,
    })
    .returning();

  return c.json({ message: "Agencia creada exitosamente", agency }, 201);
});

agenciesRoutes.patch("/:id", async (c) => {
  const user = c.get("user") as { id: number };
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const validation = updateAgencySchema.safeParse(body);

  if (!validation.success) {
    return c.json(
      { error: "Datos inválidos", details: validation.error.issues },
      400,
    );
  }

  const [agency] = await db
    .select()
    .from(agencies)
    .where(eq(agencies.id, id))
    .limit(1);
  if (!agency) {
    return c.json({ error: "Agencia no encontrada" }, 404);
  }

  if (agency.ownerId !== user.id) {
    return c.json({ error: "No tienes permiso para editar esta agencia" }, 403);
  }

  if (validation.data.email && validation.data.email !== agency.email) {
    const existingEmail = await db
      .select()
      .from(agencies)
      .where(eq(agencies.email, validation.data.email))
      .limit(1);
    if (existingEmail.length > 0) {
      return c.json({ error: "El email de agencia ya está registrado" }, 400);
    }
  }

  const [updatedAgency] = await db
    .update(agencies)
    .set(validation.data)
    .where(eq(agencies.id, id))
    .returning();

  return c.json({ message: "Agencia actualizada", agency: updatedAgency });
});

agenciesRoutes.delete("/:id", async (c) => {
  const user = c.get("user") as { id: number };
  const id = parseInt(c.req.param("id"));

  const [agency] = await db
    .select()
    .from(agencies)
    .where(eq(agencies.id, id))
    .limit(1);
  if (!agency) {
    return c.json({ error: "Agencia no encontrada" }, 404);
  }

  if (agency.ownerId !== user.id) {
    return c.json(
      { error: "No tienes permiso para eliminar esta agencia" },
      403,
    );
  }

  await db.delete(agencies).where(eq(agencies.id, id));

  return c.json({ message: "Agencia eliminada" });
});

export default agenciesRoutes;
