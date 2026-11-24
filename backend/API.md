# REST API

Base path: `/api/v1`. JSON endpoints use the response shape shown in the controller; errors use `{ "error": { "code": "...", "message": "...", "details": ... } }`.

In development, browser origins using HTTP on `localhost`, `127.0.0.1`, or `[::1]` are allowed on any port so Vite's fallback port works. Outside development, origins must exactly match `FRONTEND_ORIGINS`.

## Session and CSRF

Access and refresh credentials are HttpOnly cookies. Browser requests must send credentials. Before unsafe requests (`POST`, `PUT`, `PATCH`, `DELETE`), obtain a CSRF token from `GET /auth/csrf` and send it as `X-CSRF-Token`; the cookie must also be present.

## Endpoints

| Method | Path | Access / purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `GET` | `/health/ready` | Configuration and database readiness check |
| `GET` | `/auth/csrf` | Issue a signed CSRF cookie/token |
| `POST` | `/auth/register/employee` | Employee signup; creates a pending account |
| `POST` | `/auth/register/client` | Client signup; email and company must match the admin allowlist |
| `POST` | `/auth/login` | Email/password login |
| `POST` | `/auth/google` | Verify a Google ID token and start a backend session |
| `POST` | `/auth/refresh` | Rotate the refresh session |
| `POST` | `/auth/logout` | Revoke the current refresh session |
| `POST` | `/auth/password-reset/request` | Request a reset email |
| `POST` | `/auth/password-reset/complete` | Complete reset with a one-time token |
| `POST` | `/auth/email-verification/request` | Resend verification email |
| `POST` | `/auth/email-verification/complete` | Complete email verification |
| `GET` | `/auth/me` | Read the authenticated profile |
| `PATCH` | `/auth/me` | Update the authenticated profile |
| `POST` | `/auth/change-password` | Change the authenticated user's password |
| `GET` | `/admin/users`, `/admin/users/:userId` | Admin user listing/detail |
| `PATCH` | `/admin/users/:userId/profile` | Admin update of an employee's profile |
| `PATCH` | `/admin/users/:userId/status` | Admin account activation/suspension |
| `PATCH` | `/admin/users/:userId/role` | Admin role assignment |
| `PUT` | `/admin/users/:userId/permissions` | Admin employee permissions |
| `GET` | `/admin/employee-requests` | Admin pending employee requests |
| `PATCH` | `/admin/employees/:employeeId/approval` | Admin employee approval/rejection |
| `GET`, `POST` | `/admin/companies`, `/admin/companies/:companyId/contacts` | Admin company/contact allowlist |
| `PATCH` | `/admin/client-contacts/:contactId/status` | Admin contact activation |
| `PATCH` | `/admin/sellers/:sellerId/commission` | Admin seller commission rate |
| `GET`, `POST` | `/bills` | List/create bills; clients see only their companies |
| `GET`, `PATCH`, `DELETE` | `/bills/:billId` | Read/update/void a bill |
| `POST` | `/bills/:billId/payments` | Record a bill payment |
| `GET` | `/offers` | List offers; client results are company-scoped |
| `GET` | `/offers/:offerId` | Read an offer with ordered line items |
| `POST`, `PATCH`, `DELETE` | `/offers`, `/offers/:offerId` | Create/update offers; deletion is Admin-only |
| `GET` | `/offers/products`, `/offers/purchase-products` | Employee/Admin offer product suggestions |
| `GET` | `/products/public` | Public active product listing |
| `GET` | `/products`, `/products/categories` | Product and category listing |
| `POST` | `/products`, `/products/categories` | Product/category creation |
| `GET`, `PATCH`, `DELETE` | `/products/:productId` | Read/update/deactivate a product |
| `PATCH` | `/products/:productId/stock` | Record a stock adjustment |
| `GET` | `/seller/me`, `/seller/sales` | Seller's own dashboard and sales |
| `GET` | `/orders`, `/orders/:orderId` | Role-scoped order history/detail |
| `POST` | `/orders/checkout` | Client checkout |
| `POST`, `PATCH` | `/orders/:orderId/payments`, `/orders/:orderId/status` | Authorized order payment/status management |
| `GET`, `POST` | `/support/requests` | List or submit authenticated support requests |
| `GET` | `/support/requests/:requestId` | Read a request subject to ownership/role |
| `GET` | `/support/requests/:requestId/quotation` | Read the client's quotation |
| `GET` | `/support/requests/:requestId/attachments/:attachmentId` | Download an authorized private attachment |
| `PATCH` | `/support/requests/:requestId/status`, `/support/requests/:requestId/read` | Admin support review |
| `POST` | `/support/requests/:requestId/quotations` | Admin quotation creation |
| `PATCH` | `/support/quotations/:quotationId/status` | Admin quotation status |
| `GET` | `/reports/dashboard` | Role-scoped dashboard |
| `GET` | `/reports/financial` | Financial summary; Admin or permitted Employee |
| `GET` | `/reports/outstanding-bills`, `/reports/transactions` | Role-scoped financial reports |
| `GET`, `PUT` | `/attendance` | List attendance or create/update a unique employee/date record; Admin writes, employees read their own with `emp_tab_attendance` |
| `PATCH`, `DELETE` | `/attendance/:id` | Admin updates or deletes an attendance record |
| `GET`, `POST` | `/attendance/requests` | Employees submit attendance requests; Admins list all requests |
| `PATCH` | `/attendance/requests/:id/review` | Admin approval/rejection |
| `GET` | `/payroll?month=YYYY-MM` | Read saved monthly payroll; employees can read their own with `emp_tab_payroll` |
| `POST` | `/payroll/recalculate?month=YYYY-MM` | Admin recalculates and saves payroll from attendance and employee salary records |
| `PATCH` | `/payroll/employees/:employeeId/salary` | Admin updates an employee's base salary and advance deduction |
| `GET`, `POST` | `/challans` | List/create delivery challans; Admin or employees with client challan permissions |
| `GET`, `PATCH` | `/challans/:id` | Read/update a saved challan |
| `GET`, `POST` | `/projects` | List/create projects; clients see only projects for their companies |
| `GET`, `PATCH`, `DELETE` | `/projects/:projectId` | Read/update/delete a project |
| `GET`, `POST` | `/projects/:projectId/service-records` | Read/create a project's service schedule records |
| `PATCH`, `DELETE` | `/projects/:projectId/service-records/:recordId` | Update/delete a service schedule record |
| `GET`, `POST` | `/projects/:projectId/checklists` | List/save validated AI service checklist drafts |
| `POST` | `/projects/:projectId/checklists/generate` | Generate a bounded, validated checklist suggestion using Gemini |
| `POST` | `/projects/:projectId/checklists/:checklistId/approve` | Admin approval of a draft checklist |
| `PATCH` | `/projects/:projectId/checklists/:checklistId/tasks` | Update a task on an approved checklist |
| `GET`, `POST` | `/income` | List/create income records; Admin or employee with `reports_action_financial` |
| `GET` | `/income/employees` | List employee-account names for income entry; Admin or employee with `reports_action_financial` |
| `PATCH` | `/income/:id` | Update an income record |
| `GET` | `/notifications` | List only the authenticated user's notifications; accepts `unreadOnly=true` |
| `PATCH` | `/notifications/:id/read` | Mark the authenticated user's notification as read |
| `POST` | `/notifications` | Admin creates a notification for an active user |
| `GET`, `POST` | `/purchases` | List purchase history or atomically create a purchase and update product stock |

Offer create/update request bodies use `headerData`, `items`, `notes`, `paymentMode`, and `discountAmount`. Totals and offer numbers are calculated/assigned by the server; any submitted display totals are ignored. Item order, unit, unknown legacy item fields, and extra header fields are retained.

Purchase creation accepts `{ "items": [{ "productId": "...", "quantity": "2.5" }], "purchasedAt": "..." }` (or `date: "YYYY-MM-DD"`). It uses each active product's stored `unitPrice`, computes line and purchase totals on the server, adds `InventoryMovement` records, and updates stock in the same transaction. Price and total fields are rejected. Only Admins and employees with inventory stock/product action permission may create purchases; clients and sellers cannot.

Attendance writes and payroll recalculation are Admin-only. Employee attendance requests and employee-scoped attendance/payroll reads remain limited to the authenticated employee. Project checklist writes require the checklist/project permissions used by the callable workflow; only Admins can approve a checklist. All unsafe requests are subject to the CSRF requirements above.

## Current limitations

The initial Prisma migration has been applied to the local PostgreSQL database after confirming it contained no application tables. No Firestore data was imported. Automated tests cover HTTP authentication, validation, and selected business calculations, but CRUD flows have not been integration-tested against PostgreSQL.

Support requests and quotations require an authenticated backend account; anonymous access is not supported. Profile updates accept an HTTPS `photoUrl`; the API does not provide image upload/storage. Project bill and inventory updates, and attendance-request approval with attendance/notification updates, are not yet a single atomic operation.

AI checklist generation requires `GEMINI_API_KEY`; requests are limited to 20 per user per UTC day. Current automated tests cover endpoint authentication, request validation, and selected domain calculations; they do not replace CRUD integration tests against PostgreSQL.
