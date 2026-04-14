import { Hono } from "hono";
import { db } from "../db";
import { users, agencies, listings, favorites } from "../db/schema";
import { eq, count } from "drizzle-orm";
import { updateProfileSchema } from "../validations/profile.schema";

const profile = new Hono();

profile.get("/", async (c) => {
  const user = c.get("user") as { id: number };

  const [userData] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    phone: users.phone,
    avatarUrl: users.avatarUrl,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  }).from(users).where(eq(users.id, user.id)).limit(1);

  if (!userData) {
    return c.json({ error: "Usuario no encontrado" }, 404);
  }

  const [agencyCount] = await db.select({ count: count() }).from(agencies).where(eq(agencies.ownerId, user.id));
  const [listingCount] = await db.select({ count: count() }).from(listings).where(eq(listings.userId, user.id));
  const [favoriteCount] = await db.select({ count: count() }).from(favorites).where(eq(favorites.userId, user.id));

  return c.json({
    user: {
      ...userData,
      _count: {
        agencies: agencyCount?.count || 0,
        listings: listingCount?.count || 0,
        favorites: favoriteCount?.count || 0,
      },
    },
  });
});

profile.patch("/", async (c) => {
  const user = c.get("user") as { id: number };
  const body = await c.req.json();
  const validation = updateProfileSchema.safeParse(body);

  if (!validation.success) {
    return c.json({ error: "Datos inválidos", details: validation.error.issues }, 400);
  }

  const [userData] = await db.update(users)
    .set(validation.data)
    .where(eq(users.id, user.id))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  return c.json({ message: "Perfil actualizado", user: userData });
});

export default profile;
