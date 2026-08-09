-- AlterTable
ALTER TABLE "DemoDrive" ADD COLUMN     "speedKph" DOUBLE PRECISION NOT NULL DEFAULT 40;

-- AlterTable
ALTER TABLE "DemoFleet" ADD COLUMN     "startFacilityId" TEXT;

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "photoKey" TEXT;

-- AddForeignKey
ALTER TABLE "DemoFleet" ADD CONSTRAINT "DemoFleet_startFacilityId_fkey" FOREIGN KEY ("startFacilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
