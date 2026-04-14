import { pgTable, serial, varchar, text, timestamp, integer, real, boolean, json, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const priceTypeEnum = pgEnum("price_type", ["VENTA", "ALQUILER", "AMBOS"]);
export const propertyTypeEnum = pgEnum("property_type", ["CASA", "DEPARTAMENTO", "TERRENO", "LOCAL_COMERCIAL", "OFICINA"]);
export const propertyConditionEnum = pgEnum("property_condition", ["NUEVO", "USADO", "A_REMODELAR"]);
export const listingStatusEnum = pgEnum("listing_status", ["ACTIVO", "VENDIDO", "ALQUILADO", "PAUSADO"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  password: varchar("password", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agencies = pgTable("agencies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 50 }).notNull(),
  address: varchar("address", { length: 500 }),
  description: text("description"),
  logo: varchar("logo", { length: 500 }),
  website: varchar("website", { length: 500 }),
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  price: real("price").notNull(),
  priceType: priceTypeEnum("price_type").notNull(),
  propertyType: propertyTypeEnum("property_type").notNull(),
  
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  parkingSpaces: integer("parking_spaces"),
  area: real("area"),
  builtArea: real("built_area"),
  lotArea: real("lot_area"),
  floors: integer("floors"),
  yearBuilt: integer("year_built"),
  condition: propertyConditionEnum("property_condition"),
  amenities: json("amenities").$type<string[]>(),
  
  address: varchar("address", { length: 500 }).notNull(),
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 255 }).notNull(),
  zipCode: varchar("zip_code", { length: 20 }),
  neighborhood: varchar("neighborhood", { length: 255 }),
  latitude: real("latitude"),
  longitude: real("longitude"),
  
  status: listingStatusEnum("listing_status").default("ACTIVO"),
  views: integer("views").default(0),
  featured: boolean("featured").default(false),
  publishedAt: timestamp("published_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  agencyId: integer("agency_id").references(() => agencies.id, { onDelete: "cascade" }),
});

export const listingImages = pgTable("listing_images", {
  id: serial("id").primaryKey(),
  url: varchar("url", { length: 500 }).notNull(),
  order: integer("order").default(0),
  listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
});

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  listingId: integer("listing_id").references(() => listings.id, { onDelete: "cascade" }),
  agencyId: integer("agency_id").references(() => agencies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  agencies: many(agencies),
  listings: many(listings),
  contacts: many(contacts),
  favorites: many(favorites),
}));

export const agenciesRelations = relations(agencies, ({ one, many }) => ({
  owner: one(users, { fields: [agencies.ownerId], references: [users.id] }),
  listings: many(listings),
  favorites: many(favorites),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  user: one(users, { fields: [listings.userId], references: [users.id] }),
  agency: one(agencies, { fields: [listings.agencyId], references: [agencies.id] }),
  images: many(listingImages),
  favorites: many(favorites),
  contacts: many(contacts),
}));

export const listingImagesRelations = relations(listingImages, ({ one }) => ({
  listing: one(listings, { fields: [listingImages.listingId], references: [listings.id] }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  listing: one(listings, { fields: [contacts.listingId], references: [listings.id] }),
  user: one(users, { fields: [contacts.userId], references: [users.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  listing: one(listings, { fields: [favorites.listingId], references: [listings.id] }),
  agency: one(agencies, { fields: [favorites.agencyId], references: [agencies.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Agency = typeof agencies.$inferSelect;
export type NewAgency = typeof agencies.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type ListingImage = typeof listingImages.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
