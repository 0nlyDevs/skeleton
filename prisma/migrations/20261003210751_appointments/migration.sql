-- AlterTable
ALTER TABLE `notification` MODIFY `type` ENUM('NEW_MESSAGE', 'MENTION', 'SYSTEM', 'ROLE_CHANGED', 'POST_COMMENT', 'COMMENT_REPLY', 'POST_REACTION', 'NEW_FOLLOWER', 'GROUP_INVITE', 'MODERATION', 'GROUP_ACTIVITY', 'POST_SHARE', 'SECURITY', 'CITY_REQUEST', 'ANNOUNCEMENT', 'ALERT', 'APPOINTMENT') NOT NULL DEFAULT 'SYSTEM';

-- CreateTable
CREATE TABLE `agentSlot` (
    `id` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `mode` ENUM('IN_PERSON', 'PHONE') NOT NULL DEFAULT 'IN_PERSON',
    `location` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `agentSlot_startsAt_idx`(`startsAt`),
    INDEX `agentSlot_serviceId_startsAt_idx`(`serviceId`, `startsAt`),
    UNIQUE INDEX `agentSlot_agentId_startsAt_key`(`agentId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointment` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(20) NOT NULL,
    `slotId` VARCHAR(191) NULL,
    `citizenId` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `mode` ENUM('IN_PERSON', 'PHONE') NOT NULL,
    `location` VARCHAR(200) NULL,
    `reasonEncrypted` TEXT NOT NULL,
    `status` ENUM('BOOKED', 'CANCELLED', 'DONE', 'MISSED') NOT NULL DEFAULT 'BOOKED',
    `remindDayBefore` BOOLEAN NOT NULL DEFAULT true,
    `remindHourBefore` BOOLEAN NOT NULL DEFAULT true,
    `dayReminderSentAt` DATETIME(3) NULL,
    `hourReminderSentAt` DATETIME(3) NULL,
    `roomId` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(191) NULL,
    `cancelReason` VARCHAR(300) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `appointment_reference_key`(`reference`),
    UNIQUE INDEX `appointment_slotId_key`(`slotId`),
    INDEX `appointment_citizenId_startsAt_idx`(`citizenId`, `startsAt`),
    INDEX `appointment_agentId_startsAt_idx`(`agentId`, `startsAt`),
    INDEX `appointment_status_startsAt_idx`(`status`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agentSlot` ADD CONSTRAINT `agentSlot_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agentSlot` ADD CONSTRAINT `agentSlot_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `municipalService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `agentSlot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_citizenId_fkey` FOREIGN KEY (`citizenId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `municipalService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

