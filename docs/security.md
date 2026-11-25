# Security Notes

SecureLog demonstrates confidentiality with AES-256-GCM, integrity with SHA-256 and blockchain anchoring, authentication with JWT and bcrypt, authorization with organization-scoped RBAC, and accountability with audit records.

The prototype does not claim absolute security or regulatory compliance. Encryption keys should move to a dedicated key management service before production use. Uploaded files must be validated, stored outside public directories, and never executed.
