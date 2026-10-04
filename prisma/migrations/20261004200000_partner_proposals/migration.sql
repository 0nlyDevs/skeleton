-- CreateTable
CREATE TABLE `partnerProposal` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(20) NOT NULL,
    `organisation` VARCHAR(120) NOT NULL,
    `contactName` VARCHAR(120) NOT NULL,
    `email` VARCHAR(160) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `serviceName` VARCHAR(120) NOT NULL,
    `summary` VARCHAR(240) NOT NULL,
    `description` TEXT NOT NULL,
    `address` VARCHAR(200) NULL,
    `hours` VARCHAR(160) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'PENDING',
    `answer` VARCHAR(300) NULL,
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `serviceSlug` VARCHAR(80) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `partnerProposal_reference_key`(`reference`),
    INDEX `partnerProposal_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
