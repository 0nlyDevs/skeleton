-- CreateTable
CREATE TABLE `appointmentRequest` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(20) NOT NULL,
    `citizenId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `preferredStart` DATETIME(3) NOT NULL,
    `durationMinutes` SMALLINT NOT NULL,
    `mode` ENUM('IN_PERSON', 'PHONE') NOT NULL,
    `reasonEncrypted` TEXT NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `answer` VARCHAR(300) NULL,
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `appointmentRef` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `appointmentRequest_reference_key`(`reference`),
    INDEX `appointmentRequest_status_preferredStart_idx`(`status`, `preferredStart`),
    INDEX `appointmentRequest_citizenId_createdAt_idx`(`citizenId`, `createdAt`),
    INDEX `appointmentRequest_serviceId_idx`(`serviceId`),
    INDEX `appointmentRequest_decidedById_idx`(`decidedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `appointmentRequest` ADD CONSTRAINT `appointmentRequest_citizenId_fkey` FOREIGN KEY (`citizenId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointmentRequest` ADD CONSTRAINT `appointmentRequest_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `municipalService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointmentRequest` ADD CONSTRAINT `appointmentRequest_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

