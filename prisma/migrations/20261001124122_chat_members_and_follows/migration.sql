-- AlterTable
ALTER TABLE `room` MODIFY `type` ENUM('GLOBAL', 'POST', 'DIRECT', 'GROUP') NOT NULL DEFAULT 'GLOBAL';

-- AlterTable
ALTER TABLE `message` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `roomMember` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'MEMBER',
    `lastReadAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `roomMember_userId_idx`(`userId`),
    INDEX `roomMember_roomId_idx`(`roomId`),
    UNIQUE INDEX `roomMember_roomId_userId_key`(`roomId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `follow` (
    `id` VARCHAR(191) NOT NULL,
    `followerId` VARCHAR(191) NOT NULL,
    `followingId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `follow_followerId_idx`(`followerId`),
    INDEX `follow_followingId_idx`(`followingId`),
    UNIQUE INDEX `follow_followerId_followingId_key`(`followerId`, `followingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `roomMember` ADD CONSTRAINT `roomMember_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roomMember` ADD CONSTRAINT `roomMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow` ADD CONSTRAINT `follow_followerId_fkey` FOREIGN KEY (`followerId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow` ADD CONSTRAINT `follow_followingId_fkey` FOREIGN KEY (`followingId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
