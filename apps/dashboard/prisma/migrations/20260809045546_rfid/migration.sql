/*
  Warnings:

  - Added the required column `outcome` to the `RfidScan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RfidScanOutcome" AS ENUM ('ROUTE_STARTED', 'ROUTE_COMPLETED', 'REJECTED_UNKNOWN_DRIVER', 'REJECTED_SUSPENDED_DRIVER', 'REJECTED_NO_ACTIVE_ROUTE', 'REJECTED_PENDING_STOPS');

-- AlterTable
ALTER TABLE "RfidScan" ADD COLUMN     "outcome" "RfidScanOutcome" NOT NULL,
ADD COLUMN     "routePlanId" TEXT;

-- AlterTable
ALTER TABLE "RoutePlan" ADD COLUMN     "completedByDriverId" TEXT,
ADD COLUMN     "startedByDriverId" TEXT;

-- CreateIndex
CREATE INDEX "RfidScan_routePlanId_observedAt_idx" ON "RfidScan"("routePlanId", "observedAt");

-- AddForeignKey
ALTER TABLE "RfidScan" ADD CONSTRAINT "RfidScan_routePlanId_fkey" FOREIGN KEY ("routePlanId") REFERENCES "RoutePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutePlan" ADD CONSTRAINT "RoutePlan_startedByDriverId_fkey" FOREIGN KEY ("startedByDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutePlan" ADD CONSTRAINT "RoutePlan_completedByDriverId_fkey" FOREIGN KEY ("completedByDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
