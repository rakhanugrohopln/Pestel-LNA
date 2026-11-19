# Security Specification — PLN CORPU Firestore Rules (Phase 0)

## 1. Data Invariants
1. **Default Deny**: All unmatched paths under `/databases/{database}/documents` are denied (`allow read, write: if false`).
2. **Email Verification Gate**: All authenticated mutations require `request.auth != null && request.auth.token.email_verified == true`.
3. **No Self-Escalation**: Users cannot assign or escalate their own `role` or `orgScopeIds` on `/users/{userId}` create or update; only a verified Admin can update another user's role or organizational scope.
4. **Confidentiality & Organizational Isolation**:
   - Confidential or `internal_restricted` PESTEL issues (`classification != 'public_shared'`) can ONLY be read by members of `ownerOrgId` (stored on the user's profile doc) or approved cross-department shared viewers, never via blanket `isSignedIn()` reads.
5. **Immutable Audit Trail**: `/audit_logs/{logId}` supports authenticated `create` (with `actorUid == request.auth.uid`) and Admin-only `read`; `update` and `delete` are strictly forbidden.
6. **Temporal & Schema Integrity**: Every write passes `isValid[Entity](request.resource.data)` with strict key allowlists (`hasAll` + `hasOnly`), bounded string sizes, and valid document ID regex (`^[a-zA-Z0-9_\-]+$`).

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read** on `/users/u1` -> Denied (`request.auth == null`).
2. **Unverified email write** on `/pestel_issues/iss1` (`email_verified: false`) -> Denied.
3. **Self role escalation** on `/users/u1` create with `role: "super_admin"` -> Denied.
4. **Ghost/Shadow field injection** on `/pestel_issues/iss1` with `{ ..., isVerified: true }` -> Denied by `keys().hasOnly(...)`.
5. **ID Poisoning** with 1.5KB document ID on `/pestel_issues/{1500chars}` -> Denied by `isValidId()`.
6. **Cross-org confidential read**: User in `org-transmisi` reading `/pestel_issues/iss-pembangkitan-conf` (`classification: "confidential"`, `ownerOrgId: "org-pembangkitan"`) -> Denied.
7. **Blanket list scraping** on `/users` by non-admin -> Denied.
8. **Spoofed creator UID**: User `u1` creating `/pestel_issues/iss2` with `createdBy: "u2"` -> Denied.
9. **Immutable field tampering**: Updating `createdBy` or `createdAt` on `/pestel_issues/iss1` -> Denied.
10. **Audit log tampering**: Attempting `update` or `delete` on `/audit_logs/log1` -> Denied.
11. **Value poisoning**: Updating `severity` on `/pestel_issues/iss1` to a 50KB string or boolean -> Denied by `isValidPestelIssue()`.
12. **Terminal lock bypass**: Non-admin modifying an `approved` learning recommendation -> Denied.
