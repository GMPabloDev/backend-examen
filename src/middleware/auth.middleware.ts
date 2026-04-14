import { verify } from "jsonwebtoken";

export const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "No autorizado" }, 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verify(token, process.env.JWT_SECRET!);
    c.set("user", decoded);
    await next();
  } catch (error) {
    return c.json({ error: "Token inválido" }, 401);
  }
};
