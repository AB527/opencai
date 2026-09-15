-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC', 'OPENAI');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "chatSessionId" TEXT;

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "mutatingCommandCap" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "mutatingCommandCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sandboxContainerId" TEXT,
ADD COLUMN     "sandboxCreatedAt" TIMESTAMP(3),
ADD COLUMN     "sandboxExpiresAt" TIMESTAMP(3),
ADD COLUMN     "sandboxStatus" TEXT;

-- AlterTable
-- `provider` is converted from String to the "AiProvider" enum via a safe
-- add/backfill/drop/rename sequence instead of a direct ALTER COLUMN ... TYPE,
-- since Postgres can't auto-cast an arbitrary TEXT column to an enum and this
-- table may hold pre-Phase-6 rows with lowercase values ("anthropic"/"openai")
-- from the Phase 5 placeholder UI. The resulting column is nullable so an
-- empty table, or a never-saved settings row, doesn't block the migration.
ALTER TABLE "chat_settings" ADD COLUMN     "baseUrl" TEXT,
ADD COLUMN     "maxMutatingCommandsPerSessionDefault" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "providerApiKeyEncrypted" TEXT,
ADD COLUMN     "sandboxCommandTimeoutSeconds" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "sandboxIdleTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "spendCeilingUsd" DECIMAL(12,2),
ADD COLUMN     "provider_new" "AiProvider";

UPDATE "chat_settings" SET "provider_new" = UPPER("provider")::"AiProvider" WHERE "provider" IS NOT NULL;

ALTER TABLE "chat_settings" DROP COLUMN "provider";
ALTER TABLE "chat_settings" RENAME COLUMN "provider_new" TO "provider";

-- CreateTable
CREATE TABLE "agent_personas" (
    "id" TEXT NOT NULL,
    "mode" "ChatMode" NOT NULL,
    "subMode" "FinOpsSubMode",
    "modeKey" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "allowedBinaries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "docLookupAllowed" BOOLEAN NOT NULL DEFAULT true,
    "mutatingCommandCap" INTEGER,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_personas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_personas_modeKey_key" ON "agent_personas"("modeKey");

-- CreateIndex
CREATE INDEX "audit_logs_chatSessionId_idx" ON "audit_logs"("chatSessionId");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
