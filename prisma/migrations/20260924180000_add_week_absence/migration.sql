-- CreateTable
CREATE TABLE "WeekAbsence" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeekAbsence_playerId_idx" ON "WeekAbsence"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "WeekAbsence_weekId_playerId_key" ON "WeekAbsence"("weekId", "playerId");

-- AddForeignKey
ALTER TABLE "WeekAbsence" ADD CONSTRAINT "WeekAbsence_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekAbsence" ADD CONSTRAINT "WeekAbsence_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
