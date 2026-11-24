import { randomUUID } from "node:crypto";
import prisma from "../config/database.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { logger } from "../utils/logger.js";
import { decimal, zero } from "./billMath.js";

const pageResult = (items, total, query) => ({
  items,
  page: query.page,
  limit: query.limit,
  total,
});
const dateBounds = (filters) => ({
  ...(filters.from || filters.to ? {
    gte: filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : undefined,
    lte: filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined,
  } : {}),
});
const requirePermission = (user, ...permissions) => {
  if (user.role === "ADMIN" || (user.role === "EMPLOYEE" && permissions.some((key) => user.permissions[key]))) {
    return;
  }
  throw new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action.");
};
const requireAdmin = (user) => {
  if (user.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Administrator access is required.");
};
const dateOnly = (value) => new Date(`${value}T00:00:00.000Z`);
const decimalString = (value) => value?.toString() ?? null;

function assertChecklistAccess(user, write = true) {
  if (user.role === "ADMIN") return;
  const projectRead = ["projects_tab_serviced", "projects_schedule", "canAccessSchedule"]
    .some((key) => user.permissions[key] === true);
  const projectWrite = ["projects_action_save", "projects_action_update", "canSaveProjects"]
    .some((key) => user.permissions[key] === true);
  if (
    user.role !== "EMPLOYEE" ||
    !user.employeeId ||
    !projectRead ||
    (write && !projectWrite)
  ) throw new ApiError(403, "FORBIDDEN", "Approved project permissions are required.");
}
function assertProjectReadAccess(user) {
  if (user.role === "ADMIN") return;
  const canRead = [
    "projects_tab_summary", "projects_tab_serviced", "projects_schedule",
    "canAccessSummary", "canAccessSchedule",
  ].some((key) => user.permissions[key] === true);
  if (user.role !== "EMPLOYEE" || !user.employeeId || !canRead) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view projects.");
  }
}

function requireText(value, label, maxLength) {
  if (typeof value !== "string") throw new TypeError(`${label} must be text.`);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new RangeError(`${label} must contain 1-${maxLength} characters.`);
  return text;
}

export function validateEditedChecklist(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Checklist data is required.");
  }
  const title = requireText(value.title, "Checklist title", 120);
  if (!Array.isArray(value.tasks) || value.tasks.length < 1 || value.tasks.length > 60) {
    throw new RangeError("Checklist must contain 1-60 tasks.");
  }
  const taskIds = new Set();
  const tasks = value.tasks.map((task) => {
    const estimatedMinutes = Number(task.estimatedMinutes);
    if (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 0 || estimatedMinutes > 1440) {
      throw new TypeError("Task duration must be a whole number from 0 to 1440 minutes.");
    }
    if (!Array.isArray(task.toolsAndParts) || task.toolsAndParts.length > 20) {
      throw new TypeError("Task tools and parts must be a list of up to 20 items.");
    }
    if (!["Low", "Normal", "High"].includes(task.priority)) throw new TypeError("Task priority is invalid.");
    const id = requireText(task.id, "Task ID", 80);
    if (taskIds.has(id)) throw new TypeError("Checklist task IDs must be unique.");
    taskIds.add(id);
    return {
      id,
      section: requireText(task.section, "Task section", 100),
      title: requireText(task.title, "Task title", 160),
      description: requireText(task.description, "Task description", 1000),
      toolsAndParts: task.toolsAndParts.map((entry) => requireText(entry, "Tool or part", 120)),
      priority: task.priority,
      estimatedMinutes,
      safetyPrecautions: requireText(task.safetyPrecautions, "Safety precautions", 1000),
      status: "Pending",
      technicianNotes: "",
      assignedTechnicianUid: "",
      completedAt: "",
    };
  });
  return { title, tasks };
}

const attendanceInclude = { employee: { include: { user: { select: { id: true, email: true, name: true } } } } };
function serializeAttendance(record) {
  return {
    id: record.id,
    employeeId: record.employeeId,
    employee: record.employee ? {
      id: record.employee.id,
      userId: record.employee.user.id,
      email: record.employee.user.email,
      name: record.employee.user.name,
    } : undefined,
    date: record.date.toISOString().slice(0, 10),
    status: record.status,
    statusIn: record.statusIn,
    statusOut: record.statusOut,
    advanceDeduction: record.advanceDeduction.toString(),
    notes: record.notes,
  };
}

export async function listAttendance(user, filters) {
  if (user.role === "CLIENT" || user.role === "SELLER") {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view attendance.");
  }
  let where = {
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from || filters.to ? { date: dateBounds(filters) } : {}),
  };
  if (user.role === "EMPLOYEE") {
    requirePermission(user, "emp_tab_attendance");
    where.employeeId = user.employeeId;
  }
  const [records, total] = await prisma.$transaction([
    prisma.attendanceRecord.findMany({
      where, include: attendanceInclude, orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * filters.limit, take: filters.limit,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);
  return pageResult(records.map(serializeAttendance), total, filters);
}

export async function saveAttendance(user, data) {
  requireAdmin(user);
  const employee = await prisma.employeeProfile.findUnique({ where: { id: data.employeeId }, select: { id: true } });
  if (!employee) throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee profile not found.");
  const record = await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId: data.employeeId, date: dateOnly(data.date) } },
    create: {
      employeeId: data.employeeId, date: dateOnly(data.date), status: data.status || "PRESENT",
      statusIn: data.statusIn, statusOut: data.statusOut,
      advanceDeduction: decimal(data.advanceDeduction || "0"), notes: data.notes,
    },
    update: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.statusIn !== undefined ? { statusIn: data.statusIn } : {}),
      ...(data.statusOut !== undefined ? { statusOut: data.statusOut } : {}),
      ...(data.advanceDeduction !== undefined ? { advanceDeduction: decimal(data.advanceDeduction) } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
    include: attendanceInclude,
  });
  return serializeAttendance(record);
}

export async function updateAttendance(user, id, data) {
  requireAdmin(user);
  const record = await prisma.attendanceRecord.update({
    where: { id },
    data: {
      ...(data.date ? { date: dateOnly(data.date) } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.statusIn !== undefined ? { statusIn: data.statusIn } : {}),
      ...(data.statusOut !== undefined ? { statusOut: data.statusOut } : {}),
      ...(data.advanceDeduction !== undefined ? { advanceDeduction: decimal(data.advanceDeduction) } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
    include: attendanceInclude,
  });
  return serializeAttendance(record);
}

export async function deleteAttendance(user, id) {
  requireAdmin(user);
  await prisma.$transaction(async (tx) => {
    const record = await tx.attendanceRecord.findUnique({
      where: { id },
      select: { id: true, employeeId: true, date: true },
    });
    if (!record) throw new ApiError(404, "ATTENDANCE_NOT_FOUND", "Attendance record not found.");
    await tx.attendanceRecord.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "ATTENDANCE_DELETED",
        resourceType: "ATTENDANCE",
        resourceId: id,
        metadata: { employeeId: record.employeeId, date: record.date.toISOString().slice(0, 10) },
      },
    });
  });
  return { id };
}

export async function listAttendanceRequests(user, filters) {
  if (!["ADMIN", "EMPLOYEE"].includes(user.role)) throw new ApiError(403, "FORBIDDEN", "You do not have permission to view attendance requests.");
  const where = user.role === "ADMIN" ? {} : { employeeId: user.employeeId };
  const [items, total] = await prisma.$transaction([
    prisma.attendanceRequest.findMany({
      where, include: { employee: { include: { user: { select: { id: true, name: true, email: true } } } } },
      orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * filters.limit, take: filters.limit,
    }),
    prisma.attendanceRequest.count({ where }),
  ]);
  return pageResult(items.map((item) => ({
    id: item.id, employeeId: item.employeeId, employee: item.employee.user,
    requestedDate: item.requestedDate.toISOString().slice(0, 10), requestData: item.requestData,
    status: item.status, reviewedAt: item.reviewedAt?.toISOString() || null,
  })), total, filters);
}

export async function createAttendanceRequest(user, data) {
  if (user.role !== "EMPLOYEE" || !user.employeeId) throw new ApiError(403, "FORBIDDEN", "Only employees can submit attendance requests.");
  return prisma.attendanceRequest.create({
    data: { employeeId: user.employeeId, requestedDate: dateOnly(data.requestedDate), requestData: data.requestData },
    select: { id: true, employeeId: true, requestedDate: true, requestData: true, status: true, createdAt: true },
  });
}

export async function reviewAttendanceRequest(user, id, status) {
  requireAdmin(user);
  const record = await prisma.attendanceRequest.update({
    where: { id },
    data: { status, reviewedById: user.id, reviewedAt: new Date() },
    select: { id: true, employeeId: true, requestedDate: true, requestData: true, status: true, reviewedAt: true },
  });
  return { ...record, requestedDate: record.requestedDate.toISOString().slice(0, 10), reviewedAt: record.reviewedAt.toISOString() };
}

function payrollMonthBounds(month) {
  const [year, value] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, value - 1, 1)), end: new Date(Date.UTC(year, value, 1)) };
}
function calculatePayroll(employee, attendance, month) {
  const { start } = payrollMonthBounds(month);
  const daysInMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const fridayCount = Array.from({ length: daysInMonth }, (_, day) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day + 1)).getUTCDay()).filter((day) => day === 5).length;
  const generalWorkingDays = daysInMonth - fridayCount;
  let presentDays = 0;
  let workedFridays = 0;
  let leaveDays = 0;
  let fridayAbsents = 0;
  let attendanceAdvance = zero;
  for (const record of attendance) {
    const friday = record.date.getUTCDay() === 5;
    attendanceAdvance = attendanceAdvance.plus(record.advanceDeduction);
    if (record.status === "ABSENT") {
      if (friday) fridayAbsents += 1;
    } else if (record.status === "LEAVE") {
      leaveDays += 1;
    } else {
      presentDays += 1;
      if (friday) workedFridays += 1;
    }
  }
  const baseSalary = employee.baseSalary;
  const dailyRate = baseSalary.div(30);
  const generalWorkedDays = presentDays - workedFridays;
  const generalAbsentDays = Math.max(0, generalWorkingDays - generalWorkedDays - leaveDays);
  const absentDays = generalAbsentDays + fridayAbsents;
  const grossPayable = baseSalary.minus(dailyRate.mul(absentDays)).toDecimalPlaces(0).greaterThan(0)
    ? baseSalary.minus(dailyRate.mul(absentDays)).toDecimalPlaces(0) : zero;
  const fridayAllowance = dailyRate.mul(workedFridays).toDecimalPlaces(0);
  const advanceDeduction = attendanceAdvance.gt(0) ? attendanceAdvance : employee.advanceDeduction;
  const netPayable = grossPayable.plus(fridayAllowance).minus(advanceDeduction).greaterThan(0)
    ? grossPayable.plus(fridayAllowance).minus(advanceDeduction).toDecimalPlaces(0) : zero;
  return {
    employeeId: employee.id, month, baseSalary, presentDays, leaveDays, absentDays,
    fridayAllowance, advanceDeduction, netPayable,
  };
}

export async function listPayroll(user, filters) {
  if (user.role === "EMPLOYEE") {
    requirePermission(user, "emp_tab_payroll");
  } else requireAdmin(user);
  const where = {
    month: filters.month,
    ...(user.role === "EMPLOYEE" ? { employeeId: user.employeeId } : {}),
    ...(filters.employeeId && user.role === "ADMIN" ? { employeeId: filters.employeeId } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.monthlyPayroll.findMany({
      where, include: { employee: { include: { user: { select: { id: true, name: true, email: true } } } } },
      orderBy: { employee: { user: { name: "asc" } } },
      skip: (filters.page - 1) * filters.limit, take: filters.limit,
    }),
    prisma.monthlyPayroll.count({ where }),
  ]);
  return pageResult(items.map((item) => ({
    id: item.id, employeeId: item.employeeId, employee: item.employee.user, month: item.month,
    baseSalary: item.baseSalary.toString(), presentDays: item.presentDays.toString(),
    leaveDays: item.leaveDays.toString(), absentDays: item.absentDays.toString(),
    fridayAllowance: item.fridayAllowance.toString(), advanceDeduction: item.advanceDeduction.toString(),
    netPayable: item.netPayable.toString(), calculatedAt: item.calculatedAt.toISOString(),
  })), total, filters);
}

export async function recalculatePayroll(user, month) {
  requireAdmin(user);
  const { start, end } = payrollMonthBounds(month);
  const employees = await prisma.employeeProfile.findMany({
    where: { user: { status: "ACTIVE" } },
    include: { attendance: { where: { date: { gte: start, lt: end } } } },
  });
  return prisma.$transaction(employees.map((employee) => {
    const data = calculatePayroll(employee, employee.attendance, month);
    return prisma.monthlyPayroll.upsert({
      where: { employeeId_month: { employeeId: employee.id, month } },
      create: data, update: { ...data, calculatedAt: new Date() },
    });
  })).then((rows) => rows.map((row) => ({
    id: row.id, employeeId: row.employeeId, month: row.month,
    baseSalary: row.baseSalary.toString(), presentDays: row.presentDays.toString(),
    leaveDays: row.leaveDays.toString(), absentDays: row.absentDays.toString(),
    fridayAllowance: row.fridayAllowance.toString(), advanceDeduction: row.advanceDeduction.toString(),
    netPayable: row.netPayable.toString(), calculatedAt: row.calculatedAt.toISOString(),
  })));
}
export async function updateEmployeeSalary(user, employeeId, data) {
  requireAdmin(user);
  const updated = await prisma.$transaction(async (tx) => {
    const profile = await tx.employeeProfile.update({
      where: { id: employeeId },
      data: {
        baseSalary: decimal(data.baseSalary),
        advanceDeduction: decimal(data.advanceDeduction),
      },
      select: { id: true, baseSalary: true, advanceDeduction: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id, actorEmail: user.email, action: "EMPLOYEE_SALARY_UPDATED",
        resourceType: "EMPLOYEE", resourceId: employeeId,
        metadata: {
          baseSalary: profile.baseSalary.toString(),
          advanceDeduction: profile.advanceDeduction.toString(),
        },
      },
    });
    return profile;
  });
  return {
    employeeId: updated.id, baseSalary: updated.baseSalary.toString(),
    advanceDeduction: updated.advanceDeduction.toString(),
  };
}

function serializeChallan(record) {
  return {
    id: record.id, challanNo: record.challanNo, companyName: record.companyName, address: record.address,
    subject: record.subject, challanDate: record.challanDate?.toISOString() || null,
    items: record.items.map((item) => ({
      id: item.id, description: item.description, quantity: item.quantity.toString(), unit: item.unit,
    })),
    createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
  };
}
const challanInclude = { items: { orderBy: { id: "asc" } } };
function checkChallanAccess(user, write = false) {
  requirePermission(user, ...(write
    ? ["clients_action_save", "clients_action_update"]
    : ["clients_tab_challan", "clients_action_save", "clients_action_update"]));
}
export async function listChallans(user, filters) {
  checkChallanAccess(user);
  const where = {
    ...(filters.search ? { OR: [
      { challanNo: { contains: filters.search, mode: "insensitive" } },
      { companyName: { contains: filters.search, mode: "insensitive" } },
    ] } : {}),
    ...(filters.from || filters.to ? { challanDate: dateBounds(filters) } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.challan.findMany({
      where, include: challanInclude, orderBy: { updatedAt: "desc" },
      skip: (filters.page - 1) * filters.limit, take: filters.limit,
    }),
    prisma.challan.count({ where }),
  ]);
  return pageResult(items.map(serializeChallan), total, filters);
}
export async function getChallan(id, user) {
  checkChallanAccess(user);
  const record = await prisma.challan.findUnique({ where: { id }, include: challanInclude });
  if (!record) throw new ApiError(404, "CHALLAN_NOT_FOUND", "Challan not found.");
  return serializeChallan(record);
}
const challanData = (data) => ({
  ...(data.challanNo !== undefined ? { challanNo: data.challanNo || null } : {}),
  ...(data.companyName !== undefined ? { companyName: data.companyName || null } : {}),
  ...(data.address !== undefined ? { address: data.address || null } : {}),
  ...(data.subject !== undefined ? { subject: data.subject || null } : {}),
  ...(data.challanDate !== undefined ? { challanDate: data.challanDate ? dateOnly(data.challanDate) : null } : {}),
});
const challanItems = (items) => items.map(({ description, quantity, unit }) => ({
  description, quantity: decimal(quantity), unit: unit || null,
}));
export async function createChallan(user, data) {
  checkChallanAccess(user, true);
  const record = await prisma.challan.create({
    data: { ...challanData(data), items: { create: challanItems(data.items) } },
    include: challanInclude,
  });
  return serializeChallan(record);
}
export async function updateChallan(user, id, data) {
  checkChallanAccess(user, true);
  const record = await prisma.$transaction(async (tx) => {
    if (data.items) await tx.challanItem.deleteMany({ where: { challanId: id } });
    return tx.challan.update({
      where: { id }, data: {
        ...challanData(data),
        ...(data.items ? { items: { create: challanItems(data.items) } } : {}),
      }, include: challanInclude,
    });
  });
  return serializeChallan(record);
}

const projectInclude = {
  company: { select: { id: true, name: true } },
  billList: { orderBy: { servicingDate: "desc" } },
};
function serializeProject(project) {
  return {
    id: project.id, projectName: project.projectName, companyId: project.companyId,
    company: project.company, status: project.status, liftQuantity: project.liftQuantity,
    servicingDate: project.servicingDate?.toISOString() || null, legacyData: project.legacyData,
    serviceRecords: project.billList?.map(serializeServiceRecord),
    createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString(),
  };
}
function serializeServiceRecord(record) {
  return {
    id: record.id, projectId: record.projectId, month: record.month,
    servicingDate: record.servicingDate?.toISOString() || null, servicingStatus: record.servicingStatus,
    advanceDeduction: decimalString(record.advanceDeduction), legacyData: record.legacyData,
  };
}
async function assertProjectVisible(user, projectId) {
  if (user.role === "CLIENT") {
    const project = await prisma.project.findFirst({ where: { id: projectId, companyId: { in: user.companyIds } }, select: { id: true } });
    if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    return;
  }
  if (user.role === "EMPLOYEE") {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  }
}
export async function listProjects(user, filters) {
  if (user.role === "EMPLOYEE") assertProjectReadAccess(user);
  else if (!["ADMIN", "CLIENT"].includes(user.role)) throw new ApiError(403, "FORBIDDEN", "You do not have permission to view projects.");
  const where = {
    ...(filters.search ? { projectName: { contains: filters.search, mode: "insensitive" } } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(user.role === "CLIENT" ? { companyId: { in: user.companyIds } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.project.findMany({
      where, include: projectInclude, orderBy: { updatedAt: "desc" },
      skip: (filters.page - 1) * filters.limit, take: filters.limit,
    }),
    prisma.project.count({ where }),
  ]);
  return pageResult(items.map(serializeProject), total, filters);
}
export async function getProject(user, projectId) {
  if (user.role === "EMPLOYEE") assertProjectReadAccess(user);
  if (!["ADMIN", "CLIENT", "EMPLOYEE"].includes(user.role)) throw new ApiError(403, "FORBIDDEN", "You do not have permission to view projects.");
  await assertProjectVisible(user, projectId);
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: projectInclude });
  if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  return serializeProject(project);
}
const projectData = (data) => ({
  ...(data.companyId !== undefined ? { companyId: data.companyId } : {}),
  ...(data.projectName !== undefined ? { projectName: data.projectName } : {}),
  ...(data.status !== undefined ? { status: data.status } : {}),
  ...(data.liftQuantity !== undefined ? { liftQuantity: data.liftQuantity } : {}),
  ...(data.servicingDate !== undefined ? { servicingDate: data.servicingDate ? dateOnly(data.servicingDate) : null } : {}),
  ...(data.legacyData !== undefined ? { legacyData: data.legacyData } : {}),
});
export async function createProject(user, data) {
  requirePermission(user, "projects_action_add");
  if (data.companyId && !await prisma.company.findUnique({ where: { id: data.companyId }, select: { id: true } })) {
    throw new ApiError(404, "COMPANY_NOT_FOUND", "Company not found.");
  }
  const project = await prisma.project.create({ data: projectData(data), include: projectInclude });
  return serializeProject(project);
}
export async function updateProject(user, projectId, data) {
  requirePermission(user, "projects_action_edit");
  if (data.companyId && !await prisma.company.findUnique({ where: { id: data.companyId }, select: { id: true } })) {
    throw new ApiError(404, "COMPANY_NOT_FOUND", "Company not found.");
  }
  const project = await prisma.project.update({ where: { id: projectId }, data: projectData(data), include: projectInclude });
  return serializeProject(project);
}
export async function listServiceRecords(user, projectId) {
  if (user.role === "EMPLOYEE") assertProjectReadAccess(user);
  else if (!["ADMIN", "CLIENT"].includes(user.role)) throw new ApiError(403, "FORBIDDEN", "You do not have permission to view service schedules.");
  await assertProjectVisible(user, projectId);
  const records = await prisma.projectServiceRecord.findMany({ where: { projectId }, orderBy: { servicingDate: "desc" } });
  return { items: records.map(serializeServiceRecord) };
}
export async function createServiceRecord(user, projectId, data) {
  requirePermission(user, "projects_action_update", "projects_action_save");
  const record = await prisma.projectServiceRecord.create({
    data: {
      projectId, month: data.month, servicingDate: data.servicingDate ? dateOnly(data.servicingDate) : null,
      servicingStatus: data.servicingStatus, advanceDeduction: data.advanceDeduction == null ? null : decimal(data.advanceDeduction),
      legacyData: data.legacyData || {},
    },
  });
  return serializeServiceRecord(record);
}
export async function updateServiceRecord(user, projectId, recordId, data) {
  requirePermission(user, "projects_action_update");
  const result = await prisma.projectServiceRecord.updateMany({
    where: { id: recordId, projectId },
    data: {
      ...(data.month !== undefined ? { month: data.month } : {}),
      ...(data.servicingDate !== undefined ? { servicingDate: data.servicingDate ? dateOnly(data.servicingDate) : null } : {}),
      ...(data.servicingStatus !== undefined ? { servicingStatus: data.servicingStatus } : {}),
      ...(data.advanceDeduction !== undefined ? { advanceDeduction: data.advanceDeduction === null ? null : decimal(data.advanceDeduction) } : {}),
      ...(data.legacyData !== undefined ? { legacyData: data.legacyData } : {}),
    },
  });
  if (!result.count) throw new ApiError(404, "SERVICE_RECORD_NOT_FOUND", "Service schedule record not found.");
  const record = await prisma.projectServiceRecord.findUnique({ where: { id: recordId } });
  return serializeServiceRecord(record);
}

export async function deleteServiceRecord(user, projectId, recordId) {
  requirePermission(user, "projects_action_update");
  await prisma.$transaction(async (tx) => {
    const result = await tx.projectServiceRecord.deleteMany({
      where: { id: recordId, projectId },
    });
    if (!result.count) throw new ApiError(404, "SERVICE_RECORD_NOT_FOUND", "Service schedule record not found.");
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "PROJECT_SERVICE_RECORD_DELETED",
        resourceType: "PROJECT_SERVICE_RECORD",
        resourceId: recordId,
        metadata: { projectId },
      },
    });
  });
  return { id: recordId, projectId };
}

export async function deleteProject(user, projectId) {
  requirePermission(user, "projects_action_delete");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, projectName: true },
  });
  if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "PROJECT_DELETED",
        resourceType: "PROJECT",
        resourceId: projectId,
        metadata: { projectName: project.projectName },
      },
    });
    await tx.project.delete({ where: { id: projectId } });
  });
  return { id: projectId };
}

export async function listIncome(user, filters) {
  if (user.role === "EMPLOYEE") requirePermission(user, "reports_action_financial");
  else requireAdmin(user);
  const where = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.from || filters.to ? { occurredAt: dateBounds(filters) } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.incomeRecord.findMany({
      where, orderBy: { occurredAt: "desc" },
      skip: (filters.page - 1) * filters.limit, take: filters.limit,
    }),
    prisma.incomeRecord.count({ where }),
  ]);
  return pageResult(items.map((item) => ({
    id: item.id, type: item.type, category: item.category, amount: item.amount.toString(),
    occurredAt: item.occurredAt?.toISOString() || null, details: item.details,
    createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
  })), total, filters);
}

export async function listEmployeeNames(user) {
  if (user.role === "EMPLOYEE") requirePermission(user, "reports_action_financial");
  else requireAdmin(user);

  return prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function createIncome(user, data) {
  if (user.role === "EMPLOYEE") requirePermission(user, "reports_action_financial");
  else requireAdmin(user);
  const item = await prisma.incomeRecord.create({
    data: { ...data, createdById: user.id, occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date() },
  });
  return { id: item.id, type: item.type, category: item.category, amount: item.amount.toString(), occurredAt: item.occurredAt.toISOString(), details: item.details };
}
export async function updateIncome(user, id, data) {
  if (user.role === "EMPLOYEE") requirePermission(user, "reports_action_financial");
  else requireAdmin(user);
  const item = await prisma.incomeRecord.update({
    where: { id },
    data: {
      ...(data.type ? { type: data.type } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.amount !== undefined ? { amount: decimal(data.amount) } : {}),
      ...(data.occurredAt !== undefined ? { occurredAt: data.occurredAt ? new Date(data.occurredAt) : null } : {}),
      ...(data.details !== undefined ? { details: data.details } : {}),
    },
  });
  return { id: item.id, type: item.type, category: item.category, amount: item.amount.toString(), occurredAt: item.occurredAt?.toISOString() || null, details: item.details };
}

export async function listNotifications(user, filters) {
  const where = { userId: user.id, ...(filters.unreadOnly ? { readAt: null } : {}) };
  const [items, total] = await prisma.$transaction([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * filters.limit, take: filters.limit }),
    prisma.notification.count({ where }),
  ]);
  return pageResult(items.map((item) => ({
    id: item.id, title: item.title, message: item.message, payload: item.payload,
    readAt: item.readAt?.toISOString() || null, createdAt: item.createdAt.toISOString(),
  })), total, filters);
}
export async function markNotificationRead(user, id) {
  const result = await prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  if (!result.count) {
    const existing = await prisma.notification.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
    return { id, readAt: existing.readAt?.toISOString() || null };
  }
  return { id, readAt: new Date().toISOString() };
}
export async function createNotification(user, data) {
  requireAdmin(user);
  const recipient = await prisma.user.findFirst({ where: { id: data.userId, status: "ACTIVE" }, select: { id: true } });
  if (!recipient) throw new ApiError(404, "USER_NOT_FOUND", "Active recipient not found.");
  const item = await prisma.notification.create({ data });
  return { id: item.id, userId: item.userId, title: item.title, message: item.message, payload: item.payload, createdAt: item.createdAt.toISOString() };
}

export async function listChecklists(user, projectId) {
  assertChecklistAccess(user);
  await assertProjectVisible(user, projectId);
  const items = await prisma.serviceChecklist.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 20 });
  return items.map(serializeChecklist);
}
export async function generateChecklist(user, projectId, workDescription) {
  assertChecklistAccess(user);
  if (!env.GEMINI_API_KEY) {
    throw new ApiError(503, "AI_UNAVAILABLE", "AI checklist generation is not configured.");
  }
  await assertProjectVisible(user, projectId);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { billList: { orderBy: { servicingDate: "desc" }, take: 12 } },
  });
  if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  const description = String(workDescription || "").trim();
  if (description.length > 4000) {
    throw new ApiError(400, "INVALID_WORK_DESCRIPTION", "Work description is too long.");
  }
  const usageDate = new Date();
  usageDate.setUTCHours(0, 0, 0, 0);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.aIUsage.upsert({
      where: { userId_usageDate: { userId: user.id, usageDate } },
      create: { userId: user.id, usageDate, count: 1 },
      update: { count: { increment: 1 } },
    });
    if (updated.count > 20) {
      throw new ApiError(429, "AI_QUOTA_EXCEEDED", "Daily AI checklist limit reached. Try again tomorrow.");
    }
  });

  const responseSchema = {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      tasks: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            section: { type: "STRING" },
            title: { type: "STRING" },
            description: { type: "STRING" },
            toolsAndParts: { type: "ARRAY", items: { type: "STRING" } },
            priority: { type: "STRING", enum: ["Low", "Normal", "High"] },
            estimatedMinutes: { type: "INTEGER" },
            safetyPrecautions: { type: "STRING" },
          },
          required: ["section", "title", "description", "toolsAndParts", "priority", "estimatedMinutes", "safetyPrecautions"],
        },
      },
    },
    required: ["title", "tasks"],
  };
  let generated;
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: [
              "Create a cautious, editable elevator service checklist using only the supplied project facts.",
              "Never invent controller-specific wiring, terminal numbers, parameter values, parts, or manufacturer procedures.",
              "No approved manuals were supplied. Mark safety-critical work for qualified technician verification.",
              "Never suggest bypassing interlocks, door locks, safety circuits, or protective devices.",
              "Only include relevant tasks. Use an empty toolsAndParts list when details are unknown.",
              "All tasks are suggestions and must not be marked complete.",
              `Project facts: ${JSON.stringify({
                projectName: project.projectName || "",
                liftQuantity: project.liftQuantity || "",
                servicingDate: project.servicingDate?.toISOString() || "",
                serviceHistory: project.billList.map((record) => ({
                  month: record.month || "",
                  servicingDate: record.servicingDate?.toISOString() || "",
                  servicingStatus: record.servicingStatus || "",
                })),
              })}`,
              `Work description: ${description || "General scheduled maintenance."}`,
            ].join("\n") }],
          }],
          generationConfig: { responseMimeType: "application/json", responseSchema },
        }),
      }
    );
    if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}`);
    const body = await response.json();
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
    if (!text) throw new Error("Gemini returned no checklist.");
    const value = JSON.parse(text);
    generated = validateEditedChecklist({
      ...value,
      tasks: Array.isArray(value.tasks) ? value.tasks.map((task) => ({ ...task, id: randomUUID() })) : value.tasks,
    });
  } catch (error) {
    logger.error({ err: error, projectId, userId: user.id }, "AI checklist generation failed");
    throw new ApiError(503, "AI_UNAVAILABLE", "AI could not generate a valid checklist. Please try again.");
  }
  const checklist = { ...generated, id: randomUUID(), workDescription, createdAt: new Date().toISOString() };
  await prisma.auditLog.create({
    data: {
      actorId: user.id, actorEmail: user.email, action: "CHECKLIST_GENERATED",
      resourceType: "SERVICE_CHECKLIST", resourceId: checklist.id, metadata: { projectId },
    },
  });
  return checklist;
}
function serializeChecklist(item) {
  return {
    ...item.checklistData,
    id: item.id, projectId: item.projectId, status: item.status,
    workDescription: item.workDescription, createdBy: item.userId,
    createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
  };
}
async function checklistAudit(tx, user, action, projectId, checklistId) {
  await tx.auditLog.create({
    data: {
      actorId: user.id, actorEmail: user.email, action, resourceType: "SERVICE_CHECKLIST",
      resourceId: checklistId, metadata: { projectId },
    },
  });
}
export async function saveChecklist(user, projectId, source) {
  assertChecklistAccess(user, true);
  await assertProjectVisible(user, projectId);
  let validated;
  try { validated = validateEditedChecklist(source); } catch (error) {
    throw new ApiError(400, "INVALID_CHECKLIST", error.message);
  }
  if (source.workDescription !== undefined && (
    typeof source.workDescription !== "string" || source.workDescription.length > 4000
  )) {
    throw new ApiError(400, "INVALID_CHECKLIST", "Work description must be 4,000 characters or fewer.");
  }
  const revisionOf = typeof source.revisionOf === "string" && source.revisionOf
    ? source.revisionOf.slice(0, 80)
    : typeof source.id === "string" && source.id ? source.id.slice(0, 80) : randomUUID();
  return prisma.$transaction(async (tx) => {
    const count = await tx.serviceChecklist.count({ where: { projectId } });
    if (count >= 100) throw new ApiError(409, "CHECKLIST_LIMIT_REACHED", "This project has reached its checklist revision limit.");
    const revision = await tx.serviceChecklist.count({
      where: { projectId, OR: [{ legacyId: revisionOf }, { checklistData: { path: ["revisionOf"], equals: revisionOf } }] },
    }) + 1;
    const now = new Date().toISOString();
    const checklistData = {
      ...validated, revisionOf, revision,
      history: [{ action: "created", by: user.email, at: now }],
    };
    const item = await tx.serviceChecklist.create({
      data: { projectId, userId: user.id, status: "Draft", workDescription: source.workDescription || null, checklistData },
    });
    await checklistAudit(tx, user, "CHECKLIST_SAVED", projectId, item.id);
    return serializeChecklist(item);
  });
}
export async function approveChecklist(user, projectId, checklistId) {
  if (user.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Only an Admin can approve checklists.");
  return prisma.$transaction(async (tx) => {
    const item = await tx.serviceChecklist.findFirst({ where: { id: checklistId, projectId } });
    if (!item) throw new ApiError(404, "CHECKLIST_NOT_FOUND", "Checklist revision not found.");
    if (item.status !== "Draft") throw new ApiError(409, "CHECKLIST_NOT_DRAFT", "Only a draft checklist can be approved.");
    const now = new Date().toISOString();
    const checklistData = {
      ...item.checklistData,
      approvedBy: user.email, approvedAt: now,
      history: [...(item.checklistData.history || []).slice(-49), { action: "approved", by: user.email, at: now }],
    };
    const updated = await tx.serviceChecklist.update({
      where: { id: checklistId }, data: { status: "Approved", checklistData },
    });
    await checklistAudit(tx, user, "CHECKLIST_APPROVED", projectId, checklistId);
    return serializeChecklist(updated);
  });
}
export async function updateChecklistTask(user, projectId, checklistId, { taskId, status, technicianNotes }) {
  assertChecklistAccess(user, true);
  return prisma.$transaction(async (tx) => {
    const item = await tx.serviceChecklist.findFirst({ where: { id: checklistId, projectId } });
    if (!item || item.status !== "Approved") throw new ApiError(409, "CHECKLIST_NOT_APPROVED", "Only an approved checklist can be updated.");
    const checklistData = structuredClone(item.checklistData);
    const task = checklistData.tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new ApiError(404, "CHECKLIST_TASK_NOT_FOUND", "Checklist task not found.");
    if (task.assignedTechnicianUid && task.assignedTechnicianUid !== user.id && user.role !== "ADMIN") {
      throw new ApiError(403, "FORBIDDEN", "This task is assigned to another technician.");
    }
    const now = new Date().toISOString();
    task.status = status;
    task.technicianNotes = technicianNotes.trim();
    task.updatedBy = user.email;
    task.updatedAt = now;
    task.completedAt = status === "Complete" ? now : "";
    checklistData.history = [...(checklistData.history || []).slice(-49), { action: "task_updated", taskId, by: user.email, at: now }];
    const updated = await tx.serviceChecklist.update({ where: { id: checklistId }, data: { checklistData } });
    await checklistAudit(tx, user, "CHECKLIST_TASK_UPDATED", projectId, checklistId);
    return serializeChecklist(updated);
  });
}

function serializePurchase(purchase) {
  return {
    id: purchase.id, purchasedAt: purchase.purchasedAt.toISOString(),
    totalAmount: purchase.totalAmount.toString(),
    items: purchase.items.map((item) => ({
      id: item.id, productId: item.productId, productName: item.productName,
      quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString(), totalPrice: item.totalPrice.toString(),
    })),
    createdAt: purchase.createdAt.toISOString(),
  };
}
export async function listPurchases(user, filters) {
  requirePermission(user, "inventory_tab_products", "inventory_action_products", "inventory_action_stock");
  const where = filters.from || filters.to ? { purchasedAt: dateBounds(filters) } : {};
  const [items, total] = await prisma.$transaction([
    prisma.purchase.findMany({
      where, include: { items: { orderBy: { id: "asc" } } }, orderBy: { purchasedAt: "desc" },
      skip: (filters.page - 1) * filters.limit, take: filters.limit,
    }),
    prisma.purchase.count({ where }),
  ]);
  return pageResult(items.map(serializePurchase), total, filters);
}
export function calculatePurchaseLines(items, products) {
  const quantities = new Map();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) || zero).plus(decimal(item.quantity)));
  }
  const productById = new Map(products.map((product) => [product.id, product]));
  if ([...quantities.keys()].some((productId) => !productById.has(productId))) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "One or more active products were not found.");
  }
  return [...quantities].map(([productId, quantity]) => {
    const product = productById.get(productId);
    if (product.unitPrice.lt(0)) throw new ApiError(409, "INVALID_PRODUCT_PRICE", "Product purchase price cannot be negative.");
    return {
      productId,
      productName: product.name,
      quantity,
      unitPrice: product.unitPrice,
      totalPrice: quantity.mul(product.unitPrice).toDecimalPlaces(2),
      product,
    };
  });
}
export async function createPurchase(user, data) {
  requirePermission(user, "inventory_action_stock", "inventory_action_products");
  const quantities = new Map();
  for (const item of data.items) {
    quantities.set(item.productId, (quantities.get(item.productId) || zero).plus(decimal(item.quantity)));
  }
  const purchasedAt = data.purchasedAt ? new Date(data.purchasedAt) : data.date ? dateOnly(data.date) : new Date();
  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: [...quantities.keys()] }, status: "ACTIVE" },
      select: { id: true, name: true, unitPrice: true, stockQuantity: true, updatedAt: true },
    });
    const lines = calculatePurchaseLines(
      [...quantities].map(([productId, quantity]) => ({ productId, quantity })),
      products
    );
    const totalAmount = lines.reduce((sum, line) => sum.plus(line.totalPrice), zero).toDecimalPlaces(2);
    if (!totalAmount.gt(0)) throw new ApiError(400, "INVALID_PURCHASE_TOTAL", "Purchase total must be greater than zero.");
    const purchase = await tx.purchase.create({
      data: {
        purchasedAt, totalAmount,
        items: { create: lines.map(({ productId, productName, quantity, unitPrice, totalPrice }) => ({
          productId, productName, quantity, unitPrice, totalPrice,
        })) },
      },
      include: { items: true },
    });
    for (const line of lines) {
      const updated = await tx.product.updateMany({
        where: { id: line.productId, status: "ACTIVE" },
        data: { stockQuantity: { increment: line.quantity } },
      });
      if (updated.count !== 1) throw new ApiError(409, "PRODUCT_CHANGED", "Product stock changed during purchase. Retry the request.");
      await tx.inventoryMovement.create({
        data: { productId: line.productId, purchaseId: purchase.id, quantity: line.quantity, reason: "PURCHASE" },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id, actorEmail: user.email, action: "PURCHASE_CREATED",
        resourceType: "PURCHASE", resourceId: purchase.id,
        metadata: { totalAmount: totalAmount.toString(), itemCount: lines.length },
      },
    });
    return serializePurchase(purchase);
  });
}
