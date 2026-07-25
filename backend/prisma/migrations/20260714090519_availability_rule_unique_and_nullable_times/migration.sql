-- AlterTable
ALTER TABLE "availability_rules" ALTER COLUMN "startTime" DROP NOT NULL,
ALTER COLUMN "endTime" DROP NOT NULL,
ALTER COLUMN "slotDurationMinutes" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "availability_rules_businessId_dayOfWeek_key" ON "availability_rules"("businessId", "dayOfWeek");
