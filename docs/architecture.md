# Architecture

SecureLog separates the public website from authenticated security workflows. The frontend communicates with an independent Express API over REST and Socket.IO. The API owns authentication, RBAC, canonical hashing, AES-256-GCM encryption, storage, verification, audit records, alerts, reports, and blockchain transactions.

Supabase PostgreSQL stores metadata and encrypted payload references. The blockchain stores only integrity proof metadata: log ID, hash, category, timestamp, registrant, and active state. Secrets and full log contents never go on-chain.
