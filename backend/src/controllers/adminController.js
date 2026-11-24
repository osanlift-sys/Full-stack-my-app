import {
  addClientContact,
  assignRole,
  createCompany,
  getUser,
  listClientContacts,
  listCompanies,
  listEmployeeRequests,
  listUsers,
  reviewEmployeeRequest,
  setClientContactStatus,
  updateAccountStatus,
  updateEmployeeProfile,
  updateSellerCommission,
  updateUserPermissions,
} from "../services/adminService.js";

export async function listUsersController(req, res) {
  res.status(200).json(await listUsers(req.validatedQuery));
}

export async function getUserController(req, res) {
  res.status(200).json({ user: await getUser(req.validatedParams.userId) });
}

export async function updateEmployeeProfileController(req, res) {
  res.status(200).json({
    user: await updateEmployeeProfile(
      req.user,
      req.validatedParams.userId,
      req.validatedBody
    ),
  });
}

export async function listEmployeeRequestsController(_req, res) {
  res.status(200).json({ items: await listEmployeeRequests() });
}

export async function reviewEmployeeRequestController(req, res) {
  res.status(200).json({
    user: await reviewEmployeeRequest(
      req.user,
      req.validatedParams.employeeId,
      req.validatedBody.decision
    ),
  });
}

export async function updateAccountStatusController(req, res) {
  res.status(200).json({
    user: await updateAccountStatus(
      req.user,
      req.validatedParams.userId,
      req.validatedBody.status,
      req.validatedBody.companyId
    ),
  });
}

export async function assignRoleController(req, res) {
  res.status(200).json({
    user: await assignRole(
      req.user,
      req.validatedParams.userId,
      req.validatedBody.role
    ),
  });
}

export async function updateSellerCommissionController(req, res) {
  res.status(200).json({
    seller: await updateSellerCommission(
      req.user,
      req.validatedParams.sellerId,
      req.validatedBody.commissionRate
    ),
  });
}

export async function updateUserPermissionsController(req, res) {
  res.status(200).json({
    permissions: await updateUserPermissions(
      req.user,
      req.validatedParams.userId,
      req.validatedBody.permissions
    ),
  });
}

export async function listCompaniesController(_req, res) {
  res.status(200).json({ items: await listCompanies() });
}

export async function createCompanyController(req, res) {
  res.status(201).json({ company: await createCompany(req.user, req.validatedBody) });
}

export async function listClientContactsController(req, res) {
  res.status(200).json({
    items: await listClientContacts(req.validatedParams.companyId),
  });
}

export async function addClientContactController(req, res) {
  res.status(201).json({
    contact: await addClientContact(
      req.user,
      req.validatedParams.companyId,
      req.validatedBody
    ),
  });
}

export async function setClientContactStatusController(req, res) {
  res.status(200).json({
    contact: await setClientContactStatus(
      req.user,
      req.validatedParams.contactId,
      req.validatedBody.status
    ),
  });
}
