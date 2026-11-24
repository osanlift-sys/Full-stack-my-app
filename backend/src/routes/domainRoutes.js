import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorize.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import * as domain from "../services/domainService.js";
import {
  attendanceCreateSchema,
  attendanceQuerySchema,
  attendanceRequestSchema,
  attendanceReviewSchema,
  attendanceUpdateSchema,
  challanCreateSchema,
  challanQuerySchema,
  challanUpdateSchema,
  checklistSaveSchema,
  checklistGenerateSchema,
  checklistTaskUpdateSchema,
  checklistParamsSchema,
  idParamsSchema,
  employeeParamsSchema,
  incomeCreateSchema,
  incomeQuerySchema,
  incomeUpdateSchema,
  notificationCreateSchema,
  notificationQuerySchema,
  pageQuerySchema,
  payrollQuerySchema,
  projectCreateSchema,
  projectParamsSchema,
  projectQuerySchema,
  projectUpdateSchema,
  purchaseCreateSchema,
  purchaseQuerySchema,
  salaryUpdateSchema,
  serviceRecordParamsSchema,
  serviceRecordCreateSchema,
  serviceRecordUpdateSchema,
} from "../validators/domainValidators.js";

const attendance = Router();
attendance.use(authenticate);
attendance.get("/", validateQuery(attendanceQuerySchema), async (req, res) => {
  res.json(await domain.listAttendance(req.user, req.validatedQuery));
});
attendance.put("/", authorizeRoles("ADMIN"), validateBody(attendanceCreateSchema), async (req, res) => {
  res.status(200).json({ attendance: await domain.saveAttendance(req.user, req.validatedBody) });
});
attendance.patch("/:id", authorizeRoles("ADMIN"), validateParams(idParamsSchema), validateBody(attendanceUpdateSchema), async (req, res) => {
  res.json({ attendance: await domain.updateAttendance(req.user, req.validatedParams.id, req.validatedBody) });
});
attendance.delete("/:id", authorizeRoles("ADMIN"), validateParams(idParamsSchema), async (req, res) => {
  res.json({ attendance: await domain.deleteAttendance(req.user, req.validatedParams.id) });
});
attendance.get("/requests", authorizeRoles("ADMIN", "EMPLOYEE"), validateQuery(pageQuerySchema), async (req, res) => {
  res.json(await domain.listAttendanceRequests(req.user, req.validatedQuery));
});
attendance.post("/requests", authorizeRoles("EMPLOYEE"), validateBody(attendanceRequestSchema), async (req, res) => {
  res.status(201).json({ request: await domain.createAttendanceRequest(req.user, req.validatedBody) });
});
attendance.patch("/requests/:id/review", authorizeRoles("ADMIN"), validateParams(idParamsSchema), validateBody(attendanceReviewSchema), async (req, res) => {
  res.json({ request: await domain.reviewAttendanceRequest(req.user, req.validatedParams.id, req.validatedBody.status) });
});

const payroll = Router();
payroll.use(authenticate);
payroll.get("/", validateQuery(payrollQuerySchema), async (req, res) => {
  res.json(await domain.listPayroll(req.user, req.validatedQuery));
});
payroll.post("/recalculate", authorizeRoles("ADMIN"), validateQuery(payrollQuerySchema.pick({ month: true })), async (req, res) => {
  res.json({ items: await domain.recalculatePayroll(req.user, req.validatedQuery.month) });
});
payroll.patch("/employees/:employeeId/salary", authorizeRoles("ADMIN"), validateParams(employeeParamsSchema), validateBody(salaryUpdateSchema), async (req, res) => {
  res.json({ salary: await domain.updateEmployeeSalary(
    req.user, req.validatedParams.employeeId, req.validatedBody
  ) });
});

const challans = Router();
challans.use(authenticate);
challans.get("/", validateQuery(challanQuerySchema), async (req, res) => {
  res.json(await domain.listChallans(req.user, req.validatedQuery));
});
challans.post("/", validateBody(challanCreateSchema), async (req, res) => {
  res.status(201).json({ challan: await domain.createChallan(req.user, req.validatedBody) });
});
challans.get("/:id", validateParams(idParamsSchema), async (req, res) => {
  res.json({ challan: await domain.getChallan(req.validatedParams.id, req.user) });
});
challans.patch("/:id", validateParams(idParamsSchema), validateBody(challanUpdateSchema), async (req, res) => {
  res.json({ challan: await domain.updateChallan(req.user, req.validatedParams.id, req.validatedBody) });
});

const projects = Router();
projects.use(authenticate);
projects.get("/", validateQuery(projectQuerySchema), async (req, res) => {
  res.json(await domain.listProjects(req.user, req.validatedQuery));
});
projects.post("/", validateBody(projectCreateSchema), async (req, res) => {
  res.status(201).json({ project: await domain.createProject(req.user, req.validatedBody) });
});
projects.get("/:projectId/service-records", validateParams(projectParamsSchema), async (req, res) => {
  res.json(await domain.listServiceRecords(req.user, req.validatedParams.projectId));
});
projects.post("/:projectId/service-records", validateParams(projectParamsSchema), validateBody(serviceRecordCreateSchema), async (req, res) => {
  res.status(201).json({ serviceRecord: await domain.createServiceRecord(req.user, req.validatedParams.projectId, req.validatedBody) });
});
projects.patch("/:projectId/service-records/:recordId", validateParams(serviceRecordParamsSchema), validateBody(serviceRecordUpdateSchema), async (req, res) => {
  res.json({ serviceRecord: await domain.updateServiceRecord(req.user, req.validatedParams.projectId, req.validatedParams.recordId, req.validatedBody) });
});
projects.delete("/:projectId/service-records/:recordId", validateParams(serviceRecordParamsSchema), async (req, res) => {
  res.json({ serviceRecord: await domain.deleteServiceRecord(req.user, req.validatedParams.projectId, req.validatedParams.recordId) });
});
projects.get("/:projectId/checklists", validateParams(projectParamsSchema), async (req, res) => {
  res.json({ items: await domain.listChecklists(req.user, req.validatedParams.projectId) });
});
projects.post("/:projectId/checklists/generate", validateParams(projectParamsSchema), validateBody(checklistGenerateSchema), async (req, res) => {
  res.json({ checklist: await domain.generateChecklist(
    req.user, req.validatedParams.projectId, req.validatedBody.workDescription || ""
  ) });
});
projects.post("/:projectId/checklists", validateParams(projectParamsSchema), validateBody(checklistSaveSchema), async (req, res) => {
  res.status(201).json({ checklist: await domain.saveChecklist(req.user, req.validatedParams.projectId, req.validatedBody.checklist) });
});
projects.post("/:projectId/checklists/:checklistId/approve", authorizeRoles("ADMIN"), validateParams(checklistParamsSchema), async (req, res) => {
  res.json({ checklist: await domain.approveChecklist(req.user, req.validatedParams.projectId, req.validatedParams.checklistId) });
});
projects.patch("/:projectId/checklists/:checklistId/tasks", validateParams(checklistParamsSchema), validateBody(checklistTaskUpdateSchema), async (req, res) => {
  res.json({ checklist: await domain.updateChecklistTask(
    req.user, req.validatedParams.projectId, req.validatedParams.checklistId, req.validatedBody
  ) });
});
projects.get("/:projectId", validateParams(projectParamsSchema), async (req, res) => {
  res.json({ project: await domain.getProject(req.user, req.validatedParams.projectId) });
});
projects.patch("/:projectId", validateParams(projectParamsSchema), validateBody(projectUpdateSchema), async (req, res) => {
  res.json({ project: await domain.updateProject(req.user, req.validatedParams.projectId, req.validatedBody) });
});
projects.delete("/:projectId", validateParams(projectParamsSchema), async (req, res) => {
  res.json({ project: await domain.deleteProject(req.user, req.validatedParams.projectId) });
});

const income = Router();
income.use(authenticate);
income.get("/employees", authorizeRoles("ADMIN", "EMPLOYEE"), async (req, res) => {
  res.json({ items: await domain.listEmployeeNames(req.user) });
});
income.get("/", validateQuery(incomeQuerySchema), async (req, res) => {
  res.json(await domain.listIncome(req.user, req.validatedQuery));
});
income.post("/", validateBody(incomeCreateSchema), async (req, res) => {
  res.status(201).json({ income: await domain.createIncome(req.user, req.validatedBody) });
});
income.patch("/:id", validateParams(idParamsSchema), validateBody(incomeUpdateSchema), async (req, res) => {
  res.json({ income: await domain.updateIncome(req.user, req.validatedParams.id, req.validatedBody) });
});

const notifications = Router();
notifications.use(authenticate);
notifications.get("/", validateQuery(notificationQuerySchema), async (req, res) => {
  res.json(await domain.listNotifications(req.user, req.validatedQuery));
});
notifications.patch("/:id/read", validateParams(idParamsSchema), async (req, res) => {
  res.json({ notification: await domain.markNotificationRead(req.user, req.validatedParams.id) });
});
notifications.post("/", authorizeRoles("ADMIN"), validateBody(notificationCreateSchema), async (req, res) => {
  res.status(201).json({ notification: await domain.createNotification(req.user, req.validatedBody) });
});

const purchases = Router();
purchases.use(authenticate);
purchases.get("/", validateQuery(purchaseQuerySchema), async (req, res) => {
  res.json(await domain.listPurchases(req.user, req.validatedQuery));
});
purchases.post("/", validateBody(purchaseCreateSchema), async (req, res) => {
  res.status(201).json({ purchase: await domain.createPurchase(req.user, req.validatedBody) });
});

export {
  attendance as attendanceRoutes,
  challans as challanRoutes,
  income as incomeRoutes,
  notifications as notificationRoutes,
  payroll as payrollRoutes,
  projects as projectRoutes,
  purchases as purchaseRoutes,
};
