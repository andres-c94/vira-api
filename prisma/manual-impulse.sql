DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImpulseBlockStatus') THEN
    CREATE TYPE "ImpulseBlockStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'MISSED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImpulseActionStatus') THEN
    CREATE TYPE "ImpulseActionStatus" AS ENUM ('AVAILABLE', 'COMPLETED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ImpulseBlock" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "userProgramId" UUID NOT NULL,
  "programId" UUID NOT NULL,
  "localDate" TEXT NOT NULL,
  "blockIndex" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "status" "ImpulseBlockStatus" NOT NULL,
  "xpEarned" INTEGER NOT NULL DEFAULT 0,
  "completedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImpulseBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImpulseBlock_userProgramId_fkey" FOREIGN KEY ("userProgramId") REFERENCES "UserProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImpulseBlock_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ImpulseAction" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "impulseBlockId" UUID NOT NULL,
  "taskId" TEXT NOT NULL,
  "taskText" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "antiSpamTag" TEXT NOT NULL,
  "status" "ImpulseActionStatus" NOT NULL,
  "xpEarned" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImpulseAction_impulseBlockId_fkey" FOREIGN KEY ("impulseBlockId") REFERENCES "ImpulseBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ImpulseBlock_userId_localDate_blockIndex_key"
  ON "ImpulseBlock" ("userId", "localDate", "blockIndex");
CREATE INDEX IF NOT EXISTS "ImpulseBlock_userId_localDate_idx"
  ON "ImpulseBlock" ("userId", "localDate");
CREATE INDEX IF NOT EXISTS "ImpulseBlock_localDate_idx"
  ON "ImpulseBlock" ("localDate");

CREATE UNIQUE INDEX IF NOT EXISTS "ImpulseAction_impulseBlockId_taskId_key"
  ON "ImpulseAction" ("impulseBlockId", "taskId");
CREATE INDEX IF NOT EXISTS "ImpulseAction_impulseBlockId_idx"
  ON "ImpulseAction" ("impulseBlockId");

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "globalLeaderboardOptIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "displayName" TEXT;
