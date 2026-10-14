-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL,
    "organizerFree" BOOLEAN NOT NULL DEFAULT false,
    "organizerName" TEXT NOT NULL,
    "organizerContact" TEXT NOT NULL,
    "paymentNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'searching',
    "manageTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "isOrganizer" BOOLEAN NOT NULL DEFAULT false,
    "leaveTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Game_startsAt_idx" ON "Game"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_gameId_nameKey_key" ON "GameParticipant"("gameId", "nameKey");

-- CreateIndex
CREATE INDEX "GameParticipant_gameId_createdAt_idx" ON "GameParticipant"("gameId", "createdAt");

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
