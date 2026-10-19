# StudioNet integration tests required

Not yet implemented. Codex must deploy to live StudioNet only after confirming chain ID 61999, then independently inspect parent/child transaction receipts and actual balance changes. If RPC is unavailable, classify BLOCKED and preserve logs. Never claim success based on a method-call return value alone.
