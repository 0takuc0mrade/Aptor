CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "repositoryUrl" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "demoKey" TEXT,
    "status" TEXT NOT NULL,
    "currentStage" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Inspection_submissionKey_key" ON "Inspection"("submissionKey");
CREATE INDEX "Inspection_status_updatedAt_idx" ON "Inspection"("status", "updatedAt");
CREATE INDEX "Inspection_source_updatedAt_idx" ON "Inspection"("source", "updatedAt");

ALTER TABLE "QuarantineRun" DROP CONSTRAINT IF EXISTS "QuarantineRun_planId_key";
ALTER TABLE "QuarantineRun" ADD COLUMN "stage" TEXT;
ALTER TABLE "QuarantineRun" ADD COLUMN "progress" JSONB;
ALTER TABLE "QuarantineRun" ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX "QuarantineRun_planId_attempt_key" ON "QuarantineRun"("planId", "attempt");
