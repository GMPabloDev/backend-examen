import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

async function pushSchema() {
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  console.log("Pushing schema to database...");

  await db.delete(schema.favorites);
  await db.delete(schema.contacts);
  await db.delete(schema.listingImages);
  await db.delete(schema.listings);
  await db.delete(schema.agencies);
  await db.delete(schema.users);

  console.log("Tables recreated successfully!");

  await client.end();
}

pushSchema().catch(console.error);
