# Blockchain Design

Hardhat local development uses `LogIntegrityRegistry.sol`. The contract stores only the log ID, SHA-256-derived `bytes32` proof, category, registration timestamp, registrant, and active status. The application persists the confirmed transaction hash in Supabase PostgreSQL and displays that real value in the dashboard.

For public deployment, use a reviewed contract and controlled testnet or permissioned network. Never expose a development private key.
