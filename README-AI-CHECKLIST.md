# AI Service Checklist

The service checklist is an incremental feature attached to the existing project-details workflow.

## Current project data

Projects are read from the existing `projects` collection. The callable uses only `projectName`, `liftQty`, `servicingDate`, and a limited, reduced view of the latest `billList` entries. It does not send client addresses, phone numbers, or financial fields to Gemini.

Checklist revisions are stored at `projects/{projectId}/aiChecklists/{checklistId}`. Approval and task-progress history is stored with each revision. Privileged actions are recorded in the `ai_audit` collection. Per-user daily generation counts are stored in `ai_usage`; the current limit is 20 generation requests per Firebase UID per UTC day.

## Required setup

1. Install Functions dependencies with `npm install --prefix functions`.
2. Configure the Gemini API key as a Firebase Functions secret: `firebase functions:secrets:set GEMINI_API_KEY`.
3. Retrieve the currently deployed Firestore Rules, integrate protections for `aiChecklists`, `ai_audit`, and `ai_usage`, and test that all existing application access is preserved. Deploy the merged rules only after review. No Firestore Rules source is present in this repository, so this change intentionally does not replace the rules already used by the live app.
4. After the Rules are verified and deployed, deploy the Functions code with `firebase deploy --only functions`.

The callables require Firebase Authentication and check server-side Admin records (`app_admins` or the owner email) or employee records (`employees`) plus existing project-view and project-write flags in `user_permissions`. A pending or rejected employee is denied. Only Admins/Owners may approve. Clients and unauthorised users are not given checklist UI access. Do not grant direct client access to the new subcollection in Firestore Rules.

Gemini requests use the official `@google/genai` SDK and the current `gemini-3.8-flash` model through the Interactions API. Requests are stateless (`store: false`), have a 45-second HTTP timeout, and accept a maximum 4,000-character work description. Generated JSON is validated before being returned. Safety-sensitive work remains subject to qualified technician review.

## Scope

This release implements Feature A (project service checklists) only. Agreement generation, sales/inventory analysis, manual ingestion/RAG, employee/client-facing isolation, and Firestore Rules changes are not implemented in this increment. The service report reuses the existing `downloadInvoicePDF` helper.

Do not deploy or expose the feature to users until the Rules changes are complete. Deploying Functions alone does not replace or tighten Firestore Security Rules.

New signup requests no longer include the submitted password in Firestore. Existing `pendingRequests` documents that already contain `data.password` require a carefully reviewed, one-time cleanup; this change does not modify live Firestore data.
