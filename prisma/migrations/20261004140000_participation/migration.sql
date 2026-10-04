-- CreateTable
CREATE TABLE `cityProject` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `summary` VARCHAR(300) NOT NULL,
    `body` TEXT NOT NULL,
    `zone` ENUM('CRYSTAL_REACH', 'VERDANT_BASIN', 'EMBER_WASTES', 'FROSTPEAK', 'SUNKEN_DELTA', 'NOVA_PRIME', 'OBSIDIAN_COAST', 'SKYPORT_ISLES') NULL,
    `budget` INTEGER NULL,
    `status` ENUM('PLANNED', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'PLANNED',
    `startsOn` DATE NULL,
    `endsOn` DATE NULL,
    `progress` TINYINT NOT NULL DEFAULT 0,
    `consultationOpen` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cityProject_slug_key`(`slug`),
    INDEX `cityProject_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projectOpinion` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `stance` ENUM('FOR', 'AGAINST', 'NEUTRAL') NOT NULL,
    `comment` VARCHAR(600) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `projectOpinion_userId_idx`(`userId`),
    UNIQUE INDEX `projectOpinion_projectId_userId_key`(`projectId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `decision` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `question` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `opensAt` DATETIME(3) NOT NULL,
    `closesAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `decision_slug_key`(`slug`),
    INDEX `decision_closesAt_idx`(`closesAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `decisionOption` (
    `id` VARCHAR(191) NOT NULL,
    `decisionId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `position` TINYINT NOT NULL DEFAULT 0,

    INDEX `decisionOption_decisionId_idx`(`decisionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `decisionBallot` (
    `id` VARCHAR(191) NOT NULL,
    `decisionId` VARCHAR(191) NOT NULL,
    `optionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `receipt` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `decisionBallot_receipt_key`(`receipt`),
    INDEX `decisionBallot_optionId_idx`(`optionId`),
    INDEX `decisionBallot_userId_idx`(`userId`),
    UNIQUE INDEX `decisionBallot_decisionId_userId_key`(`decisionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idea` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(20) NOT NULL,
    `title` VARCHAR(140) NOT NULL,
    `body` VARCHAR(1500) NOT NULL,
    `zone` ENUM('CRYSTAL_REACH', 'VERDANT_BASIN', 'EMBER_WASTES', 'FROSTPEAK', 'SUNKEN_DELTA', 'NOVA_PRIME', 'OBSIDIAN_COAST', 'SKYPORT_ISLES') NULL,
    `status` ENUM('RECEIVED', 'STUDYING', 'KEPT', 'DECLINED', 'DONE') NOT NULL DEFAULT 'RECEIVED',
    `answer` VARCHAR(1000) NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `idea_reference_key`(`reference`),
    INDEX `idea_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `idea_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ideaSupport` (
    `id` VARCHAR(191) NOT NULL,
    `ideaId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ideaSupport_userId_idx`(`userId`),
    UNIQUE INDEX `ideaSupport_ideaId_userId_key`(`ideaId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `projectOpinion` ADD CONSTRAINT `projectOpinion_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `cityProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projectOpinion` ADD CONSTRAINT `projectOpinion_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `decisionOption` ADD CONSTRAINT `decisionOption_decisionId_fkey` FOREIGN KEY (`decisionId`) REFERENCES `decision`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `decisionBallot` ADD CONSTRAINT `decisionBallot_decisionId_fkey` FOREIGN KEY (`decisionId`) REFERENCES `decision`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `decisionBallot` ADD CONSTRAINT `decisionBallot_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `decisionOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `decisionBallot` ADD CONSTRAINT `decisionBallot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `idea` ADD CONSTRAINT `idea_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ideaSupport` ADD CONSTRAINT `ideaSupport_ideaId_fkey` FOREIGN KEY (`ideaId`) REFERENCES `idea`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ideaSupport` ADD CONSTRAINT `ideaSupport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

