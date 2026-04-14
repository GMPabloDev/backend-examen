import { Hono } from "hono";
import { db } from "../db";
import { contacts, listings, users, agencies } from "../db/schema";
import { eq, desc, count, or, and, sql } from "drizzle-orm";
import { createContactSchema } from "../validations/contact.schema";

const contactsRoutes = new Hono();

contactsRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const validation = createContactSchema.safeParse(body);

  if (!validation.success) {
    return c.json({ error: "Datos inválidos", details: validation.error.issues }, 400);
  }

  const { listingId, ...contactData } = validation.data;

  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!listing) {
    return c.json({ error: "Anuncio no encontrado" }, 404);
  }

  const user = c.get("user") as { id: number } | undefined;
  
  const [contact] = await db.insert(contacts).values({
    ...contactData,
    listingId,
    userId: user?.id || null,
  }).returning();

  return c.json({ message: "Mensaje enviado exitosamente", contact }, 201);
});

contactsRoutes.get("/my-received", async (c) => {
  const user = c.get("user") as { id: number };
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  const userAgencies = await db.select({ id: agencies.id }).from(agencies).where(eq(agencies.ownerId, user.id));
  const agencyIds = userAgencies.map(a => a.id);

  const condition = or(
    and(...agencyIds.map(id => sql`listings.agency_id = ${id}`)),
    eq(listings.userId, user.id)
  );

  const contactList = await db.select({
    id: contacts.id,
    name: contacts.name,
    email: contacts.email,
    phone: contacts.phone,
    message: contacts.message,
    createdAt: contacts.createdAt,
    listing: {
      id: listings.id,
      title: listings.title,
    },
    user: {
      id: users.id,
      name: users.name,
      email: users.email,
    },
  })
    .from(contacts)
    .leftJoin(listings, eq(contacts.listingId, listings.id))
    .leftJoin(users, eq(contacts.userId, users.id))
    .where(condition)
    .orderBy(desc(contacts.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() })
    .from(contacts)
    .leftJoin(listings, eq(contacts.listingId, listings.id))
    .where(condition);

  return c.json({
    contacts: contactList,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

contactsRoutes.get("/my-sent", async (c) => {
  const user = c.get("user") as { id: number };
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  const contactList = await db.select({
    id: contacts.id,
    name: contacts.name,
    email: contacts.email,
    phone: contacts.phone,
    message: contacts.message,
    createdAt: contacts.createdAt,
    listing: {
      id: listings.id,
      title: listings.title,
      firstImage: sql<string>`(SELECT url FROM listing_images WHERE listing_id = listings.id ORDER BY "order" ASC LIMIT 1)`,
    },
  })
    .from(contacts)
    .leftJoin(listings, eq(contacts.listingId, listings.id))
    .where(eq(contacts.userId, user.id))
    .orderBy(desc(contacts.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(contacts).where(eq(contacts.userId, user.id));

  return c.json({
    contacts: contactList,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

contactsRoutes.get("/:id", async (c) => {
  const user = c.get("user") as { id: number };
  const id = parseInt(c.req.param("id"));

  const [contact] = await db.select({
    id: contacts.id,
    name: contacts.name,
    email: contacts.email,
    phone: contacts.phone,
    message: contacts.message,
    createdAt: contacts.createdAt,
    listing: {
      id: listings.id,
      title: listings.title,
      userId: listings.userId,
      agencyId: listings.agencyId,
    },
    user: {
      id: users.id,
      name: users.name,
      email: users.email,
    },
  })
    .from(contacts)
    .leftJoin(listings, eq(contacts.listingId, listings.id))
    .leftJoin(users, eq(contacts.userId, users.id))
    .where(eq(contacts.id, id))
    .limit(1);

  if (!contact) {
    return c.json({ error: "Contacto no encontrado" }, 404);
  }

  const userAgencies = await db.select({ id: agencies.id }).from(agencies).where(eq(agencies.ownerId, user.id));
  const agencyIds = userAgencies.map(a => a.id);

  const isRecipient =
    contact.listing?.userId === user.id ||
    agencyIds.includes(contact.listing?.agencyId || 0) ||
    contact.user?.id === user.id;

  if (!isRecipient) {
    return c.json({ error: "No tienes acceso a este contacto" }, 403);
  }

  return c.json({ contact });
});

export default contactsRoutes;
