import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Test database bootstrap.
 * Uses a dedicated PostgreSQL database (capital_agro_test) so the dev DB is never touched.
 * The schema is pushed and the idempotent seed is run once per test run.
 */
export const prisma = new PrismaClient();

export async function setupTestDb() {
  const devUrl = process.env.DATABASE_URL ?? "postgresql://postgres:mero1901@localhost:5432/capital_agro";
  const testUrl = devUrl.replace(/\/[^/]*$/, "/capital_agro_test");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: process.cwd(),
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
  execSync("npx tsx prisma/seed.ts", {
    cwd: process.cwd(),
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}

export async function teardownTestDb() {
  await prisma.$disconnect();
}

/** Login helper returning an Authorization header for a given role's user. */
export async function login(app: import("express").Express, email: string, password = "Admin@123") {
  const { default: request } = await import("supertest");
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(200);
  return { Authorization: `Bearer ${res.body.token}` };
}