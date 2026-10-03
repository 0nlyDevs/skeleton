-- AlterTable
ALTER TABLE `notification` MODIFY `type` ENUM('NEW_MESSAGE', 'MENTION', 'SYSTEM', 'ROLE_CHANGED', 'POST_COMMENT', 'COMMENT_REPLY', 'POST_REACTION', 'NEW_FOLLOWER', 'GROUP_INVITE', 'MODERATION', 'GROUP_ACTIVITY', 'POST_SHARE', 'SECURITY', 'CITY_REQUEST', 'ANNOUNCEMENT') NOT NULL DEFAULT 'SYSTEM';

-- CreateTable
CREATE TABLE `municipalService` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `category` VARCHAR(60) NOT NULL,
    `summary` VARCHAR(240) NOT NULL,
    `description` TEXT NOT NULL,
    `howTo` TEXT NULL,
    `email` VARCHAR(160) NULL,
    `phone` VARCHAR(40) NULL,
    `hours` VARCHAR(160) NULL,
    `address` VARCHAR(200) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `icon` VARCHAR(40) NOT NULL DEFAULT 'building',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `municipalService_slug_key`(`slug`),
    INDEX `municipalService_active_sortOrder_idx`(`active`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcement` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `summary` VARCHAR(300) NOT NULL,
    `body` TEXT NOT NULL,
    `category` ENUM('ANNOUNCEMENT', 'SERVICE_CHANGE', 'PRACTICAL', 'EVENT', 'ALERT') NOT NULL DEFAULT 'ANNOUNCEMENT',
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `coverImage` VARCHAR(200) NULL,
    `serviceId` VARCHAR(191) NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `announcement_slug_key`(`slug`),
    INDEX `announcement_publishedAt_deletedAt_idx`(`publishedAt`, `deletedAt`),
    INDEX `announcement_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cityRequest` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(20) NOT NULL,
    `citizenId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `subject` VARCHAR(160) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('NEW', 'IN_PROGRESS', 'WAITING_CITIZEN', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'NEW',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `assigneeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `closedAt` DATETIME(3) NULL,

    UNIQUE INDEX `cityRequest_reference_key`(`reference`),
    INDEX `cityRequest_citizenId_createdAt_idx`(`citizenId`, `createdAt`),
    INDEX `cityRequest_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `cityRequest_assigneeId_status_idx`(`assigneeId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cityRequestMessage` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `internal` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cityRequestMessage_requestId_createdAt_idx`(`requestId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cityRequestEvent` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `kind` VARCHAR(30) NOT NULL,
    `fromValue` VARCHAR(60) NULL,
    `toValue` VARCHAR(60) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cityRequestEvent_requestId_createdAt_idx`(`requestId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webcupRequest` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `externalId` INTEGER NULL,
    `requesterName` VARCHAR(160) NULL,
    `requesterType` VARCHAR(80) NULL,
    `message` TEXT NOT NULL,
    `difficulty` VARCHAR(40) NULL,
    `difficultyLevel` INTEGER NULL,
    `xpBase` INTEGER NOT NULL DEFAULT 0,
    `xpTimeBonus` INTEGER NOT NULL DEFAULT 0,
    `xpTotal` INTEGER NOT NULL DEFAULT 0,
    `xpAvailable` INTEGER NOT NULL DEFAULT 0,
    `isInitial` BOOLEAN NOT NULL DEFAULT false,
    `wave` INTEGER NULL,
    `arrivalType` VARCHAR(40) NULL,
    `arrivalTime` VARCHAR(20) NULL,
    `groupName` VARCHAR(120) NULL,
    `isAiRelated` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NULL,
    `raw` JSON NOT NULL,
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `triage` ENUM('TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED') NOT NULL DEFAULT 'TODO',
    `note` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `webcupRequest_code_key`(`code`),
    INDEX `webcupRequest_visible_wave_idx`(`visible`, `wave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webcupFeedState` (
    `key` VARCHAR(20) NOT NULL,
    `session` JSON NULL,
    `lastFetchAt` DATETIME(3) NULL,
    `lastSuccessAt` DATETIME(3) NULL,
    `lastError` VARCHAR(300) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `announcement` ADD CONSTRAINT `announcement_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `municipalService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement` ADD CONSTRAINT `announcement_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cityRequest` ADD CONSTRAINT `cityRequest_citizenId_fkey` FOREIGN KEY (`citizenId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cityRequest` ADD CONSTRAINT `cityRequest_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `municipalService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cityRequest` ADD CONSTRAINT `cityRequest_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cityRequestMessage` ADD CONSTRAINT `cityRequestMessage_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `cityRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cityRequestMessage` ADD CONSTRAINT `cityRequestMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cityRequestEvent` ADD CONSTRAINT `cityRequestEvent_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `cityRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cityRequestEvent` ADD CONSTRAINT `cityRequestEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

