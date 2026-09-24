-- AlterTable
ALTER TABLE "Week" ADD COLUMN     "capacity" INTEGER;

-- CreateTable
CREATE TABLE "WeekWaitlist" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeekWaitlist_playerId_idx" ON "WeekWaitlist"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "WeekWaitlist_weekId_playerId_key" ON "WeekWaitlist"("weekId", "playerId");

-- AddForeignKey
ALTER TABLE "WeekWaitlist" ADD CONSTRAINT "WeekWaitlist_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekWaitlist" ADD CONSTRAINT "WeekWaitlist_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
