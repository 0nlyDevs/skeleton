-- CreateTable
CREATE TABLE `messageReaction` (
    `messageId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(10) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messageReaction_userId_idx`(`userId`),
    PRIMARY KEY (`messageId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `messageReaction` ADD CONSTRAINT `messageReaction_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messageReaction` ADD CONSTRAINT `messageReaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

