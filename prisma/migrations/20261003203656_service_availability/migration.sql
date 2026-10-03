-- AlterTable
ALTER TABLE `municipalService` ADD COLUMN `alternativeServiceId` VARCHAR(191) NULL,
    ADD COLUMN `availability` ENUM('AVAILABLE', 'MAINTENANCE', 'INCIDENT') NOT NULL DEFAULT 'AVAILABLE',
    ADD COLUMN `availabilityNote` VARCHAR(500) NULL,
    ADD COLUMN `availableAgainAt` DATETIME(3) NULL,
    ADD COLUMN `unavailableFrom` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `municipalService_availability_idx` ON `municipalService`(`availability`);

-- CreateIndex
CREATE INDEX `municipalService_alternativeServiceId_idx` ON `municipalService`(`alternativeServiceId`);

-- AddForeignKey
ALTER TABLE `municipalService` ADD CONSTRAINT `municipalService_alternativeServiceId_fkey` FOREIGN KEY (`alternativeServiceId`) REFERENCES `municipalService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

