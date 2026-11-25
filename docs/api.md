# API Surface

Planned API groups include `/api/auth`, `/api/logs`, `/api/verifications`, `/api/alerts`, `/api/audit`, `/api/reports`, `/api/api-clients`, and `/api/dashboard`.

External applications ingest through `POST /api/v1/logs/ingest` using an API key. The backend validates the request, canonicalizes the content, calculates SHA-256, encrypts it with AES-256-GCM, stores metadata, anchors the hash on-chain, and returns the real identifiers.
