import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

import authRoutes from "./modules/auth/routes.js";
import securityRoutes from "./modules/security/routes.js";
import supplierRoutes from "./modules/supplier/routes.js";
import inventoryRoutes from "./modules/inventory/routes.js";
import procurementRoutes from "./modules/procurement/routes.js";
import transferRoutes from "./modules/transfers/routes.js";
import recipeRoutes from "./modules/recipe/routes.js";
import stocktakingRoutes from "./modules/stocktaking/routes.js";
import financeRoutes from "./modules/finance/routes.js";
import analyticsRoutes from "./modules/analytics/routes.js";
import dashboardRoutes from "./modules/dashboard/routes.js";
import masterDataRoutes from "./modules/master-data/routes.js";

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  // Rate limiting: strict on credential endpoints, general on the API surface.
  // Successful logins are skipped so a legit user can never lock themselves out;
  // only failed attempts count toward the window.
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, skipSuccessfulRequests: true, message: { error: "Too many login attempts. Try again in 15 minutes." } });
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Rate limit exceeded" } });

  app.get("/health", (_req, res) => res.json({ status: "ok", service: "capital-agro-erp", time: new Date().toISOString() }));

  app.use("/api/v1/auth/login", authLimiter);
  app.use("/api/v1", apiLimiter);

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/security", securityRoutes);
  app.use("/api/v1/suppliers", supplierRoutes);
  app.use("/api/v1/inventory", inventoryRoutes);
  app.use("/api/v1/procurement", procurementRoutes);
  app.use("/api/v1/transfers", transferRoutes);
  app.use("/api/v1/recipes", recipeRoutes);
  app.use("/api/v1/stocktaking", stocktakingRoutes);
  app.use("/api/v1/finance", financeRoutes);
  app.use("/api/v1/analytics", analyticsRoutes);
  app.use("/api/v1/dashboard", dashboardRoutes);
  app.use("/api/v1/master-data", masterDataRoutes);

  // Serve static client assets in production if available
  const clientDistCandidates = [
    process.env.CLIENT_DIST_PATH,
    path.resolve(process.cwd(), "client/dist"),
    path.resolve(process.cwd(), "../client/dist"),
    path.resolve(__dirname, "../../client/dist"),
    path.resolve(__dirname, "../client/dist"),
  ].filter(Boolean) as string[];

  const resolvedClientDist = clientDistCandidates.find((p) => fs.existsSync(p) && fs.existsSync(path.join(p, "index.html")));
  if (resolvedClientDist) {
    app.use(express.static(resolvedClientDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path === "/health") return next();
      res.sendFile(path.join(resolvedClientDist, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}