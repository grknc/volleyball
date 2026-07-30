/*
  Warnings:

  - Added the required column `updatedAt` to the `Player` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Match_weekId_idx" ON "Match"("weekId");

-- CreateIndex
CREATE INDEX "Match_teamAId_idx" ON "Match"("teamAId");

-- CreateIndex
CREATE INDEX "Match_teamBId_idx" ON "Match"("teamBId");

-- CreateIndex
CREATE INDEX "TeamPlayer_playerId_idx" ON "TeamPlayer"("playerId");

-- CreateIndex
CREATE INDEX "WeekAttendee_playerId_idx" ON "WeekAttendee"("playerId");

-- CreateIndex
CREATE INDEX "WeeklyMvp_playerId_idx" ON "WeeklyMvp"("playerId");
