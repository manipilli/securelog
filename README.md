# SecureLog

SecureLog is a tamper-evident log integrity verification platform for an academic security prototype. It combines SHA-256 fingerprints, AES-256-GCM encrypted storage, organization-scoped access control, and blockchain-registered integrity proofs.

## Workspace

- `frontend/` React + Vite public website and application shell
- `backend/` independent Express API foundation
- `blockchain/` Hardhat contract foundation
- `docs/` architecture and deployment notes

## Run locally

```powershell
npm install
npm run dev
```

Run `npm run dev` from the project root so both the frontend and API start. Starting only the frontend workspace leaves authentication unavailable. Open `http://127.0.0.1:5173`; the API health endpoint is `http://127.0.0.1:4000/api/health`.

Create an account, complete the local development one-time code shown on screen, then upload a `.log`, `.txt`, `.json`, or `.csv` file in the dashboard. The API hashes the original bytes with SHA-256, compresses them only when that reduces size, encrypts the stored payload with AES-256-GCM, and verifies by decrypting/decompressing and comparing the original hash. Local metadata persists in `backend/data/state.json`; encrypted files are kept under `backend/storage/`.
Set `SUPABASE_DB_URL` (or `POSTGRES_URL` / `DATABASE_URL`) to persist account/log/alert metadata and encrypted payloads in Supabase PostgreSQL; without it, local metadata persists in `backend/data/state.json`.

This is a local academic prototype, not a production deployment. Email/SMS delivery, Supabase PostgreSQL persistence, and live blockchain anchoring require additional service configuration and are not represented as active when they are not connected. Use managed secrets, HTTPS, backups, operational monitoring, and a reviewed smart-contract deployment before production use.
