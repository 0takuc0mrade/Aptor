CREATE TABLE "QuarantinePlan" (
  "id" TEXT NOT NULL,
  "scanId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "runtime" TEXT NOT NULL,
  "packageManager" TEXT NOT NULL,
  "command" JSONB NOT NULL,
  "timeoutMs" INTEGER NOT NULL,
  "memoryLimitMb" INTEGER NOT NULL,
  "cpuLimit" DOUBLE PRECISION NOT NULL,
  "processLimit" INTEGER NOT NULL,
  "outputLimitBytes" INTEGER NOT NULL,
  "networkPolicy" TEXT NOT NULL,
  "allowedDomains" JSONB NOT NULL,
  "lifecycleScripts" JSONB NOT NULL,
  "canaries" JSONB NOT NULL,
  "plan" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuarantinePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuarantineRun" (
  "id" TEXT NOT NULL,
  "scanId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "error" TEXT,
  "terminationReason" TEXT,
  "networkPolicy" TEXT,
  "containerMetadata" JSONB,
  "result" JSONB,
  "combinedReport" JSONB,
  "explanation" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuarantineRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RuntimeEvent" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "type" TEXT NOT NULL,
  "processId" INTEGER,
  "parentProcessId" INTEGER,
  "command" TEXT,
  "filePath" TEXT,
  "destination" TEXT,
  "canaryId" TEXT,
  "outcome" TEXT,
  "evidence" TEXT NOT NULL,
  CONSTRAINT "RuntimeEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RuntimeFinding" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "evidence" TEXT,
  "recommendation" TEXT NOT NULL,
  "runtimeEvidence" JSONB,
  CONSTRAINT "RuntimeFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RuntimeAttackPathNode" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "pathId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "evidenceKind" TEXT NOT NULL,
  "findingId" TEXT,
  "runtimeEventId" TEXT,
  "filePath" TEXT,
  "line" INTEGER,
  "processId" INTEGER,
  "policyDecision" TEXT,
  CONSTRAINT "RuntimeAttackPathNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RuntimeAttackPathEdge" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "pathId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sourceExternalId" TEXT NOT NULL,
  "targetExternalId" TEXT NOT NULL,
  "evidenceKind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  CONSTRAINT "RuntimeAttackPathEdge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuarantineRun_planId_key" ON "QuarantineRun"("planId");
CREATE INDEX "QuarantinePlan_scanId_createdAt_idx" ON "QuarantinePlan"("scanId", "createdAt");
CREATE INDEX "QuarantineRun_scanId_createdAt_idx" ON "QuarantineRun"("scanId", "createdAt");
CREATE INDEX "QuarantineRun_status_createdAt_idx" ON "QuarantineRun"("status", "createdAt");
CREATE UNIQUE INDEX "RuntimeEvent_runId_externalId_key" ON "RuntimeEvent"("runId", "externalId");
CREATE INDEX "RuntimeEvent_runId_timestamp_idx" ON "RuntimeEvent"("runId", "timestamp");
CREATE INDEX "RuntimeEvent_type_idx" ON "RuntimeEvent"("type");
CREATE UNIQUE INDEX "RuntimeFinding_runId_externalId_key" ON "RuntimeFinding"("runId", "externalId");
CREATE INDEX "RuntimeFinding_runId_severity_idx" ON "RuntimeFinding"("runId", "severity");
CREATE UNIQUE INDEX "RuntimeAttackPathNode_runId_externalId_key" ON "RuntimeAttackPathNode"("runId", "externalId");
CREATE INDEX "RuntimeAttackPathNode_runId_pathId_idx" ON "RuntimeAttackPathNode"("runId", "pathId");
CREATE UNIQUE INDEX "RuntimeAttackPathEdge_runId_externalId_key" ON "RuntimeAttackPathEdge"("runId", "externalId");
CREATE INDEX "RuntimeAttackPathEdge_runId_pathId_idx" ON "RuntimeAttackPathEdge"("runId", "pathId");
ALTER TABLE "QuarantinePlan" ADD CONSTRAINT "QuarantinePlan_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuarantineRun" ADD CONSTRAINT "QuarantineRun_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuarantineRun" ADD CONSTRAINT "QuarantineRun_planId_fkey" FOREIGN KEY ("planId") REFERENCES "QuarantinePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuntimeEvent" ADD CONSTRAINT "RuntimeEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QuarantineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuntimeFinding" ADD CONSTRAINT "RuntimeFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QuarantineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuntimeAttackPathNode" ADD CONSTRAINT "RuntimeAttackPathNode_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QuarantineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuntimeAttackPathEdge" ADD CONSTRAINT "RuntimeAttackPathEdge_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QuarantineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
