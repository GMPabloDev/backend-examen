import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./middleware/auth.middleware";
import authRoutes from "./routes/auth.routes";
import profileRoutes from "./routes/profile.routes";
import agenciesRoutes from "./routes/agencies.routes";
import listingsRoutes from "./routes/listings.routes";
import contactsRoutes from "./routes/contacts.routes";
import favoritesRoutes from "./routes/favorites.routes";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/", (c) => c.json({ message: "API de Bienes Raíces", version: "1.0.0" }));
app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/auth", authRoutes);

app.use("/profile/*", authMiddleware);
app.use("/agencies/*", authMiddleware);
app.use("/listings/*", authMiddleware);
app.use("/contacts/*", authMiddleware);
app.use("/favorites/*", authMiddleware);

app.route("/profile", profileRoutes);
app.route("/agencies", agenciesRoutes);
app.route("/listings", listingsRoutes);
app.route("/contacts", contactsRoutes);
app.route("/favorites", favoritesRoutes);

app.get("*", (c) => c.json({ error: "Ruta no encontrada" }, 404));

app.onError((err, c) => {
  console.error("Error:", err);
  return c.json({ error: "Error interno del servidor" }, 500);
});

export default app;
