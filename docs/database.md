# Database Design

Core collections are `Organization`, `User`, `Log`, `Verification`, `AuditLog`, `Alert`, `ApiClient`, `Report`, and `BlockchainTransaction`. Every organization-owned record carries `organizationId`; API authorization must scope queries by the authenticated organization before role checks.

Encrypted payloads are stored outside public web directories. Database records hold ciphertext metadata, IV, authentication tag, canonical SHA-256 hash, and references, never encryption keys.
