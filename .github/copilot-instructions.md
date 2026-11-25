# SecureLog workspace instructions

- Preserve the separation between public website, authenticated dashboard, Express API, MongoDB metadata, and blockchain proof.
- Use the wording `tamper-evident`; do not claim absolute security or fabricate statistics, hashes, transaction IDs, or verification results.
- Keep security logic in the backend. Scope organization-owned resources before applying RBAC.
- Validate uploaded files, use canonical SHA-256 hashing and AES-256-GCM with unique IVs, and never store keys in database records.
- Use `npm run build --workspace frontend` for the frontend build and `npm run dev --workspace backend` for the API.
