-- CreateTable
CREATE TABLE `poll` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `multiple` BOOLEAN NOT NULL DEFAULT false,
    `closesAt` DATETIME(3) NULL,
    `totalVoters` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `poll_postId_key`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pollOption` (
    `id` VARCHAR(191) NOT NULL,
    `pollId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `position` INTEGER NOT NULL,
    `voteCount` INTEGER NOT NULL DEFAULT 0,

    INDEX `pollOption_pollId_position_idx`(`pollId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pollVote` (
    `pollId` VARCHAR(191) NOT NULL,
    `optionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pollVote_pollId_userId_idx`(`pollId`, `userId`),
    INDEX `pollVote_userId_idx`(`userId`),
    PRIMARY KEY (`optionId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `poll` ADD CONSTRAINT `poll_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pollOption` ADD CONSTRAINT `pollOption_pollId_fkey` FOREIGN KEY (`pollId`) REFERENCES `poll`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pollVote` ADD CONSTRAINT `pollVote_pollId_fkey` FOREIGN KEY (`pollId`) REFERENCES `poll`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pollVote` ADD CONSTRAINT `pollVote_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `pollOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pollVote` ADD CONSTRAINT `pollVote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

