DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuggestionType') THEN
    CREATE TYPE "SuggestionType" AS ENUM ('IDEA', 'PROBLEM', 'IMPROVEMENT', 'OTHER');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuggestionStatus') THEN
    CREATE TYPE "SuggestionStatus" AS ENUM ('NEW', 'REVIEWED', 'DISCARDED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "UserSuggestion" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID,
  "type" "SuggestionType" NOT NULL,
  "message" TEXT NOT NULL,
  "email" TEXT,
  "status" "SuggestionStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserSuggestion_userId_idx" ON "UserSuggestion" ("userId");
CREATE INDEX IF NOT EXISTS "UserSuggestion_status_idx" ON "UserSuggestion" ("status");
