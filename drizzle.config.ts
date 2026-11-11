import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // Use your own Supabase connection string (Project Settings -> Database)
    url: process.env.DATABASE_URL ?? "",
  },
});
