-- F74: partner associations and structured opening hours.
ALTER TABLE `municipalService` ADD COLUMN `openingHours` JSON NULL,
    ADD COLUMN `partner` BOOLEAN NOT NULL DEFAULT false;

-- F73: official messages from the High Council.
CREATE TABLE `officialMessage` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(140) NOT NULL,
    `body` VARCHAR(600) NOT NULL,
    `action` VARCHAR(300) NULL,
    `linkHref` VARCHAR(200) NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `withdrawnAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `officialMessage_withdrawnAt_expiresAt_publishedAt_idx`(`withdrawnAt`, `expiresAt`, `publishedAt`),
    INDEX `officialMessage_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- F76: comments left after using a service.
CREATE TABLE `serviceFeedback` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(20) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NULL,
    `rating` TINYINT NOT NULL,
    `comment` TEXT NOT NULL,
    `status` ENUM('RECEIVED', 'READ', 'ANSWERED') NOT NULL DEFAULT 'RECEIVED',
    `readAt` DATETIME(3) NULL,
    `reply` TEXT NULL,
    `repliedById` VARCHAR(191) NULL,
    `repliedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `serviceFeedback_reference_key`(`reference`),
    INDEX `serviceFeedback_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `serviceFeedback_serviceId_createdAt_idx`(`serviceId`, `createdAt`),
    INDEX `serviceFeedback_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `serviceFeedback_requestId_idx`(`requestId`),
    INDEX `serviceFeedback_repliedById_idx`(`repliedById`),
    UNIQUE INDEX `serviceFeedback_userId_requestId_key`(`userId`, `requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `municipalService_partner_active_idx` ON `municipalService`(`partner`, `active`);

ALTER TABLE `officialMessage` ADD CONSTRAINT `officialMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `serviceFeedback` ADD CONSTRAINT `serviceFeedback_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `serviceFeedback` ADD CONSTRAINT `serviceFeedback_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `municipalService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `serviceFeedback` ADD CONSTRAINT `serviceFeedback_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `cityRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `serviceFeedback` ADD CONSTRAINT `serviceFeedback_repliedById_fkey` FOREIGN KEY (`repliedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
