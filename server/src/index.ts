import { createApp } from "./app.js";
import { config } from "./config.js";
import { startScheduler } from "./lib/scheduler.js";

const app = createApp();
const port = Number(process.env.PORT ?? config.port ?? 4000);

app.listen(port, () => {
  console.log(`Capital Agro ERP API listening on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});

// Background jobs: scheduled reports, expiration alerts, ROP recalc, cycle counts
if (process.env.DISABLE_SCHEDULER !== "true") {
  startScheduler();
}