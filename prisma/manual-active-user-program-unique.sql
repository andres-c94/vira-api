CREATE UNIQUE INDEX IF NOT EXISTS user_program_active_unique_idx
ON "UserProgram" ("userId", "programId")
WHERE status = 'ACTIVE';
