import { config } from "dotenv";

/**
 * Runs before every test file is imported.
 * Points Prisma at the dedicated PostgreSQL test DB. dotenv.config() in
 * src/config.ts will NOT override an already-set env var, so this wins.
 */
config({ path: new URL("../.env", import.meta.url) });
const devUrl = process.env.DATABASE_URL ?? "postgresql://postgres:mero1901@localhost:5432/capital_agro";
process.env.DATABASE_URL = devUrl.replace(/\/[^/]*$/, "/capital_agro_test");
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";