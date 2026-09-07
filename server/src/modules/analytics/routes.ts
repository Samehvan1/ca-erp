import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { audit } from "../../lib/audit.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { AuditAction, ReportFrequency, Role } from "@prisma/client";
import { generators, localize, REPORT_ACCESS, REPORT_CODES } from "../../lib/reports.js";

const router = Router();
router.use(requireAuth);

// ============ REPORT ENDPOINTS ============

router.get(
  "/definitions",
  asyncHandler(async (_req, res) => {
    const defs = await prisma.reportDefinition.findMany({ orderBy: { code: "asc" } });
    res.json(defs);
  })
);

router.get(
  "/:code",
  asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase();
    const generator = generators[code];
    if (!generator) throw notFound(`Unknown report code: ${code}`);
    const allowed = REPORT_ACCESS[code];
    if (allowed && !allowed.includes(req.user!.role)) throw badRequest("Role not permitted for this report");
    const data = await generator();
    const lang = (req.query.lang as string) ?? "EN";
    res.json({ code, lang, generatedAt: new Date(), rows: localize(data, lang) });
  })
);

router.post(
  "/:code/snapshot",
  requireRole(Role.ADMIN, Role.CFO, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase();
    const generator = generators[code];
    if (!generator) throw notFound(`Unknown report code: ${code}`);
    const period = (req.query.period as string) ?? new Date().toISOString().slice(0, 10);
    const data = await generator();
    const snapshot = await prisma.reportSnapshot.create({ data: { reportCode: code, period, data: data as unknown as object } });
    await audit({ userId: req.user!.id, action: AuditAction.POST, entityType: "ReportSnapshot", entityId: String(snapshot.id), after: { code, period }, ip: req.ip });
    res.status(201).json(snapshot);
  })
);

router.get(
  "/snapshots/history",
  asyncHandler(async (_req, res) => {
    const snapshots = await prisma.reportSnapshot.findMany({ orderBy: { generatedAt: "desc" }, take: 100 });
    res.json(snapshots);
  })
);

// ============ SCHEDULING ============

const scheduleSchema = z.object({ reportCode: z.enum(REPORT_CODES), frequency: z.nativeEnum(ReportFrequency), recipients: z.array(z.string().email()).min(1) });

router.get(
  "/schedules/list",
  asyncHandler(async (_req, res) => {
    const schedules = await prisma.scheduledReport.findMany({ orderBy: { id: "desc" } });
    res.json(schedules);
  })
);

router.post(
  "/schedules",
  requireRole(Role.ADMIN, Role.CFO),
  asyncHandler(async (req, res) => {
    const body = scheduleSchema.parse(req.body);
    const schedule = await prisma.scheduledReport.create({ data: { reportCode: body.reportCode, frequency: body.frequency, recipients: body.recipients as unknown as object } });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "ScheduledReport", entityId: String(schedule.id), after: body, ip: req.ip });
    res.status(201).json(schedule);
  })
);

router.patch(
  "/schedules/:id",
  requireRole(Role.ADMIN, Role.CFO),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ active: z.boolean().optional(), frequency: z.nativeEnum(ReportFrequency).optional() }).parse(req.body);
    const schedule = await prisma.scheduledReport.update({ where: { id }, data: body });
    res.json(schedule);
  })
);

router.delete(
  "/schedules/:id",
  requireRole(Role.ADMIN, Role.CFO),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const schedule = await prisma.scheduledReport.findUnique({ where: { id } });
    if (!schedule) throw notFound("Schedule not found");
    await prisma.scheduledReport.delete({ where: { id } });
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "ScheduledReport", entityId: String(id), before: { reportCode: schedule.reportCode }, ip: req.ip });
    res.json({ ok: true });
  })
);

export default router;