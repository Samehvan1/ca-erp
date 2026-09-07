import { execSync } from "node:child_process";
import { config } from "dotenv";

/**
 * Global test setup: fresh dedicated PostgreSQL test database, then push schema + seed.
 * Runs once before the whole suite in a separate process.
 *
 * Derives the test DB URL from the dev DATABASE_URL (swaps the database name),
 * so credentials live in one place (.env).
 */
export default function globalSetup() {
  config({ path: new URL("../.env", import.meta.url) });
  const devUrl = process.env.DATABASE_URL ?? "postgresql://postgres:mero1901@localhost:5432/capital_agro";
  const TEST_DB = "capital_agro_test";
  const testUrl = devUrl.replace(/\/[^/]*$/, `/${TEST_DB}`);

  const url = new URL(devUrl);
  const user = url.username || "postgres";
  const pass = url.password;
  const host = url.hostname || "localhost";
  const port = url.port || "5432";
  const env = { ...process.env, PGPASSWORD: pass, DATABASE_URL: testUrl };

  // Drop + recreate the test database (WITH (FORCE) kills active connections)
  execSync(`psql -U ${user} -h ${host} -p ${port} -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE);"`, { stdio: "pipe", env });
  execSync(`psql -U ${user} -h ${host} -p ${port} -d postgres -c "CREATE DATABASE ${TEST_DB};"`, { stdio: "pipe", env });

  execSync("npx prisma db push --skip-generate --accept-data-loss", { cwd: process.cwd(), stdio: "pipe", env });
  execSync("npx tsx prisma/seed.ts", { cwd: process.cwd(), stdio: "pipe", env });
}