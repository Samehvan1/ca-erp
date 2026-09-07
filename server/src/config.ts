import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "capital-agro-dev-secret",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  env: process.env.NODE_ENV || "development",
};