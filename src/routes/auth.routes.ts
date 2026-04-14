import { Hono } from "hono";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { sign } from "jsonwebtoken";
import { loginSchema } from "../validations/login.schema";
import { registerSchema } from "../validations/register.schema";

const auth = new Hono();

auth.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: "Datos inválidos", details: validation.error.issues }, 400);
    }

    const { email, name, password } = validation.data;

    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      return c.json({ error: "El email ya está registrado" }, 400);
    }

    const hashedPassword = await Bun.password.hash(password, "bcrypt");

    const [user] = await db.insert(users).values({
      email,
      name: name || null,
      password: hashedPassword,
    }).returning({ id: users.id, email: users.email, name: users.name });

    const token = sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return c.json({ message: "Usuario registrado exitosamente", user, token }, 201);
  } catch (error) {
    console.error("Error en registro:", error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

auth.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: "Datos inválidos", details: validation.error.issues }, 400);
    }

    const { email, password } = validation.data;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return c.json({ error: "Credenciales inválidas" }, 401);
    }

    const isValidPassword = await Bun.password.verify(password, user.password);
    if (!isValidPassword) {
      return c.json({ error: "Credenciales inválidas" }, 401);
    }

    const token = sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    const { password: _, ...userWithoutPassword } = user;
    return c.json({ message: "Login exitoso", user: userWithoutPassword, token }, 200);
  } catch (error) {
    console.error("Error en login:", error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

export default auth;
