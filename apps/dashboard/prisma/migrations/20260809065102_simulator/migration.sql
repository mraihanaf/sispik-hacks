-- CreateEnum
CREATE TYPE "DemoDriveMode" AS ENUM ('AUTOMATIC', 'MANUAL', 'PAUSED', 'STOPPED');

-- CreateTable
CREATE TABLE "DemoFleet" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "trackerDeviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoFleet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoDrive" (
    "id" TEXT NOT NULL,
    "fleetId" TEXT NOT NULL,
    "routePlanId" TEXT,
    "mode" "DemoDriveMode" NOT NULL DEFAULT 'STOPPED',
    "waypointIndex" INTEGER NOT NULL DEFAULT 0,
    "controlLease" TEXT,
    "controlLeaseExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoDrive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoFleet_vehicleId_key" ON "DemoFleet"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "DemoFleet_driverId_key" ON "DemoFleet"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "DemoFleet_trackerDeviceId_key" ON "DemoFleet"("trackerDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DemoDrive_fleetId_key" ON "DemoDrive"("fleetId");

-- CreateIndex
CREATE UNIQUE INDEX "DemoDrive_routePlanId_key" ON "DemoDrive"("routePlanId");

-- AddForeignKey
ALTER TABLE "DemoFleet" ADD CONSTRAINT "DemoFleet_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoFleet" ADD CONSTRAINT "DemoFleet_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoFleet" ADD CONSTRAINT "DemoFleet_trackerDeviceId_fkey" FOREIGN KEY ("trackerDeviceId") REFERENCES "IoTDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoDrive" ADD CONSTRAINT "DemoDrive_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "DemoFleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoDrive" ADD CONSTRAINT "DemoDrive_routePlanId_fkey" FOREIGN KEY ("routePlanId") REFERENCES "RoutePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
