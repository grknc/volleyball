-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 90;

-- AlterTable
ALTER TABLE "GameParticipant" ADD COLUMN     "note" TEXT;

