-- AlterTable
ALTER TABLE "Week" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';

-- CreateIndex
CREATE INDEX "Week_status_idx" ON "Week"("status");

-- Backfill: the ALTER TABLE above set every existing row to 'draft' by
-- default, which would suddenly hide all historical weeks (including ones
-- with completed matches) from the public site now that 'draft' means
-- "fully hidden". Reclassify existing rows based on their actual data
-- state so no previously-public week disappears.
UPDATE "Week" SET "status" = 'completed'
WHERE EXISTS (
  SELECT 1 FROM "Match" m WHERE m."weekId" = "Week"."id"
  AND jsonb_array_length(m."sets"::jsonb) >= 2
);

UPDATE "Week" SET "status" = 'published'
WHERE "status" = 'draft' AND EXISTS (
  SELECT 1 FROM "Team" t WHERE t."weekId" = "Week"."id"
);
