export const normalizeEmail = (email) => email.trim().toLowerCase();

export const normalizeCompanyName = (name) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

export function toPublicUser(user) {
  const publicUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    photoUrl: user.photoUrl,
  };
  if (user.employee) {
    publicUser.employeeId = user.employee.id;
    publicUser.employee = {
      designation: user.employee.designation || null,
      phone: user.employee.phone || null,
      address: user.employee.address || null,
    };
  }
  if (user.permissions) {
    publicUser.permissions = Object.fromEntries(
      user.permissions.map(({ key, enabled }) => [key, enabled])
    );
  }
  if (user.clientMemberships) {
    publicUser.companies = user.clientMemberships.map(({ company }) => ({
      id: company.id,
      name: company.name,
      address: company.address,
      phone: company.phone,
      email: company.email,
      status: company.status,
    }));
  }
  return publicUser;
}
