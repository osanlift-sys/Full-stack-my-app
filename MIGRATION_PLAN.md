# Firebase Backend Migration Plan

## Current cutover status

The frontend now uses the Express API for the migrated authentication and business workflows. Firebase SDK/configuration, Functions source, Hosting configuration, and local Firebase environment entries have been removed. The root production build passes. The initial Prisma migration was applied to the verified-empty local PostgreSQL database; no Firestore export or import was performed.

Backend tests and schema checks pass, but database-backed CRUD integration has not been verified. See [backend/API.md](./backend/API.md) for workflow limitations and access requirements.

## Phase 1 — Repository analysis (complete; pre-cutover snapshot)

### Application and integration surface

- The frontend is a Vite React 19 application using JavaScript ES modules, React Router 6, Redux Toolkit, CSS Modules, and `html2pdf.js`.
- The Redux store is in `src/App/Store.js` and combines auth, clients, offers, invoices, challans, stock/purchases, sales, projects, attendance, payroll, and support state.
- Firebase is initialized in `src/Firebase/Firebase.js`. Browser auth uses local persistence; `src/main.jsx` restores the current Firebase user and caches a profile in `localStorage`.
- Firebase Auth is used for email/password signup, login, reset email, logout, and Google popup login. Signup currently supports admin-created employee approval; the owner email is embedded in the frontend and Functions code.
- Firestore reads/writes are spread across slices and pages, not isolated behind a repository. The Firebase integration must therefore be replaced incrementally, preserving each Redux thunk's contract and page behavior.
- `functions/index.js` contains callable AI service-checklist operations (generate, edit, approve, and delete) using Gemini, project/employee permissions, daily quotas, and audit records. This is separate from the requested REST modules and needs an explicit parity/cutover decision before Firebase Functions are removed.
- PDFs are generated in the browser by `src/HndlePDF/HndlePDF.js`; current quotation/invoice views should continue using that path unless a later requirement needs server-side PDFs.
- File inputs exist for support-request images and employee profile images. No Firebase Storage upload integration was found; support currently stores file data/metadata in the Firestore request flow. A backend upload path must preserve the visible form behavior while validating size and type.
- Hosting is Firebase Hosting with a Functions source directory (`firebase.json`). No backend deployment target or PostgreSQL connection is configured in the repository.

### Firestore collections and observed data shape

Observed names and structures from application reads/writes (document fields are heterogeneous and should be confirmed against a real export before schema conversion):

| Firestore path / collection | Observed use and relationships |
| --- | --- |
| `signUpData/{email}` | Profile stored under `data`; name, email, role, uid, photoURL, createdAt. |
| `pendingRequests/{email}` | Employee signup/approval record, usually nested under `data`; name, email, status, requestedAt. |
| `employees/{normalizedEmail}` | Employee profile, often nested under `data`; status, designation, salary, and other profile fields. |
| `app_admins/{normalizedEmail}` | Admin allowlist/profile; the owner is also specially handled in code. |
| `user_permissions/{email}` | Per-user boolean feature permissions (navigation, clients, projects, employee actions). |
| `offer/{normalizedCompany}/offersList/{offerId}` | Company-scoped offers; `headerData`, items/products, offer number, dates, totals, timestamps. |
| `bill/{normalizedCompany}/bill_lists/{billId}` | Company-scoped bills/sales; line items, bill/payment totals, payment history/status, `createdType`, dates. |
| `challan/{challanId}` | Saved delivery challan and item data. |
| `purchase/{itemId}` | Current stock aggregate with item name, quantity, unit/selling price, total, timestamps. |
| `purchaseTransactions/{id}` | Purchase event with date, total, items, and creation time. Stock changes and purchase transaction writes are atomic in Firestore. |
| `offerProducts/{id}` | Product-like records used when composing offers. |
| `projects/{projectId}` | Lift/service projects with project fields and embedded `billList`/service history; updates can also adjust stock. |
| `attendance/{employeeKey}/{month}/{date}` | Nested attendance and salary advance records; both email- and name-derived employee keys occur. |
| `attendance_requests/{id}` | Employee attendance correction requests and admin decisions. |
| `notifications/{id}` | Attendance/admin notifications and read state. |
| `technicalSupportRequests/{requestId}` | Support request, contact/service details, attachments, status, quotation items/totals and suggestions. |
| `installationIncome/{id}`, `conveyance/{id}`, `billsAllowances/{id}` | AIBay income, travel/conveyance, and allowance records; queried in dashboard summaries. |
| `systemCounters/offerId` | Transactionally allocated offer number counter. |
| `ai_usage/{uid}` | Per-user daily checklist usage counter; `aiChecklists` is a nested subcollection. |
| `ai_audit/{id}` | Callable-function audit events. |

`offerList` and `salesList` are fallback collection-group names in read code. Existing records may use legacy layouts not represented by the primary writes above.

No canonical client, seller, order/cart, or payment collection is referenced in the inspected application. Client summaries are inferred from company names in offer/bill records. Sellers and order processing are not existing frontend features, so those requested modules need new, explicit data and UI contracts rather than inferred legacy records. Client email/company mappings also cannot be confirmed from source code alone.

### Existing authorization and business behavior

- The only established application roles found are `Admin`, `Employee`, and a generic `User`. Admins are resolved from an owner-email special case or `app_admins`; approved employees and `user_permissions` gate specific pages/actions.
- AdminPanel exposes permissions for header navigation, clients, projects, and employee profile/attendance/list/payroll actions. Preserve these granular permissions on the server; a hidden navigation item is not authorization.
- Registration currently creates pending employee requests, then provisions an employee account after approval. The frontend permits a special owner signup path. The replacement must instead bootstrap the first admin out of band and never trust a submitted role.
- Google sign-in is an existing behavior. The new auth API's required password flow alone would remove it unless OAuth is intentionally retained.
- Bill/payment amounts are currently represented by mixed numeric/string fields and embedded payment history. The relational conversion must parse/validate amounts while retaining original document IDs, timestamps, and unrecognized legacy fields for reconciliation.
- The project checklist callable authorizes approved employees based on selected project permissions, limits AI use to 20/day, audits mutations, and includes explicit elevator safety constraints. Keep these server-side controls if the callable is migrated.

## Implementation sequence

1. **Phase 1 — Analysis and plan:** complete this inventory; compare it to a read-only Firestore export before finalizing data conversion.
2. **Phase 2 — Backend foundation:** add an isolated `backend/` ES-module Express service, environment validation, logging, `/api/v1` routing, security middleware, centralized errors, and a health route. Keep the existing frontend and Firebase deployment operational.
3. **Phase 3 — Prisma/PostgreSQL schema:** model observed entities (including employee permissions, attendance, project service history, offers, bills, payments, stock/purchases, support/quotations, notifications, and income records), retain legacy document IDs/raw data for staged reconciliation, and add requested user/client/seller/product/order tables with Decimal money fields and indexes.
4. **Phase 4 — Authentication and authorization:** add bcrypt credentials, access/refresh cookies, rotation/revocation, reset/change-password flows, account statuses, employee approval, role checks and granular permissions. Keep admin provisioning server-only.
5. **Phase 5 — User management:** implement admin approval/rejection and managed account state before switching user workflows.
6. **Phase 6 — Bills/payments:** migrate bill CRUD and payment history with transactional, Decimal-based balance updates and existing PDF UX.
7. **Phase 7 — Products/sellers:** map current purchase stock and offer products, then add seller ownership and enforce seller isolation.
8. **Phase 8 — Orders:** define server-side cart/checkout and atomic stock/order behavior; no existing order implementation was found.
9. **Phase 9 — Technical support/quotations:** implement authenticated requests, validated uploads, admin workflows, and preserve client quotation PDF generation.
10. **Phase 10 — Dashboards/reports:** reproduce existing client, project, payroll, and AIBay summaries and add requested role dashboards.
11. **Phase 11 — Frontend integration:** replace Firebase call sites module by module with a shared HTTP client/Redux thunks or RTK Query; preserve routes, CSS Modules, components, and PDF behavior. Firebase dependencies were removed after the API cutover.
12. **Phase 12 — Fresh database onboarding:** use the new Prisma/PostgreSQL database without importing Firestore records, as explicitly requested. Existing Firebase Auth users must reset/re-enroll.
13. **Phase 13 — Testing/security review:** run backend and frontend tests, verify role/client/seller isolation and financial transactions, and audit the cutover.
14. **Phase 14 — Documentation/deployment:** document environment setup, migrations, backup/rollback, hosting, and cutover. Firebase removal is complete; production static hosting must now be configured outside Firebase.

## Constraints and prerequisites for later phases

- Firestore export/import is explicitly out of scope; the new version starts with an empty Prisma database.
- Database migrations and integration tests require a local PostgreSQL instance and a private `backend/.env` configured by the operator. Do not put credentials in source control or chat.
- Client signup authorization needs a trusted company-contact email mapping. The current source only derives client names from billing documents.
- Email delivery is required for password-reset links. Google OAuth credentials are needed only if Google login is retained.
- The callable checklist workflow has been replaced by authenticated REST endpoints; configure `GEMINI_API_KEY` privately to enable generation.
- Firebase Authentication password hashes cannot be reused as bcrypt hashes. Users will need an email-verified password reset/re-enrollment flow; Google users must reauthenticate with Google.

## Progress

- **Phase 1 complete:** repository inventory and migration plan recorded above.
- **Phases 2-10 complete:** Express APIs, Prisma schema, authentication/admin flows, operational endpoints, reports, and AI checklist routes are implemented.
- **Phase 3 complete:** Prisma schema validates; the initial migration was created and applied to the local database after confirming it contained no application tables.
- **Phase 11 complete:** Firebase-backed frontend calls were replaced by `apiClient`/Redux API calls. Password reset and email verification use backend endpoints. Support and quotation screens require a backend login.
- **Phase 13 validation:** backend tests pass (56 tests); Prisma validation and backend syntax checks pass; frontend production build passes. PostgreSQL-backed CRUD integration and external email/Gemini provider calls remain unverified. Full ESLint still reports two existing Fast Refresh errors in `src/AIBay/AIBay.jsx` and `src/main.jsx`.
- **Known workflow gaps:** project bill plus inventory changes and attendance-request approval plus attendance/notification updates are not atomic; profile images must already be hosted at an HTTPS URL; anonymous support is not available.
- **Phase 14 complete for code cleanup:** removed the Firebase frontend package/config, Functions source/dependencies, Hosting config, local Firebase environment entries, and hosting cache. A static hosting provider and production database/API environment still need deployment configuration.
- **Cutover decision:** use the fresh Prisma database with no Firestore import. Legacy Firebase users must re-enroll or reset their password; Firebase Authentication credentials are not migrated.

### Confirmed onboarding decisions

- Retain Google sign-in using Google OAuth ID-token verification; configure `GOOGLE_CLIENT_ID` privately.
- Use an admin-managed client contact allowlist. Signup must match both normalized email and normalized company name; being present in a bill/offer alone does not grant account access.
- The new sign-up UX should let users choose Employee or Client; Client registration must collect the authorized company name. Admin accounts remain server-provisioned.
- Configure PostgreSQL and SMTP locally in ignored `backend/.env`; never place credentials in this document or source control.
