-- AlterTable
ALTER TABLE `message` ADD COLUMN `editedAt` DATETIME(3) NULL,
    ADD COLUMN `uploadId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `notification` MODIFY `type` ENUM('NEW_MESSAGE', 'MENTION', 'SYSTEM', 'ROLE_CHANGED', 'POST_COMMENT', 'COMMENT_REPLY', 'POST_REACTION', 'NEW_FOLLOWER', 'GROUP_INVITE', 'MODERATION', 'GROUP_ACTIVITY') NOT NULL DEFAULT 'SYSTEM';

-- AlterTable
ALTER TABLE `post` ADD COLUMN `editedAt` DATETIME(3) NULL,
    ADD COLUMN `groupId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `upload` ADD COLUMN `height` INTEGER NULL,
    ADD COLUMN `width` INTEGER NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `lastSeenAt` DATETIME(3) NULL,
    ADD COLUMN `showPresence` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `postMedia` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `uploadId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `postMedia_uploadId_key`(`uploadId`),
    INDEX `postMedia_postId_position_idx`(`postId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mention` (
    `id` VARCHAR(191) NOT NULL,
    `mentionedUserId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NULL,
    `commentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mention_mentionedUserId_createdAt_idx`(`mentionedUserId`, `createdAt`),
    INDEX `mention_authorId_idx`(`authorId`),
    UNIQUE INDEX `mention_postId_mentionedUserId_key`(`postId`, `mentionedUserId`),
    UNIQUE INDEX `mention_commentId_mentionedUserId_key`(`commentId`, `mentionedUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(60) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `description` TEXT NULL,
    `privacy` ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
    `coverImage` VARCHAR(200) NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `memberCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `group_slug_key`(`slug`),
    INDEX `group_privacy_deletedAt_memberCount_idx`(`privacy`, `deletedAt`, `memberCount`),
    INDEX `group_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `groupMember` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `status` ENUM('ACTIVE', 'PENDING', 'BANNED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `groupMember_userId_status_idx`(`userId`, `status`),
    INDEX `groupMember_groupId_status_role_idx`(`groupId`, `status`, `role`),
    UNIQUE INDEX `groupMember_groupId_userId_key`(`groupId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messageHide` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messageHide_userId_idx`(`userId`),
    UNIQUE INDEX `messageHide_messageId_userId_key`(`messageId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `message_uploadId_key` ON `message`(`uploadId`);

-- CreateIndex
CREATE INDEX `post_groupId_deletedAt_createdAt_idx` ON `post`(`groupId`, `deletedAt`, `createdAt`);

-- AddForeignKey
ALTER TABLE `post` ADD CONSTRAINT `post_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `postMedia` ADD CONSTRAINT `postMedia_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `postMedia` ADD CONSTRAINT `postMedia_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `upload`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mention` ADD CONSTRAINT `mention_mentionedUserId_fkey` FOREIGN KEY (`mentionedUserId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mention` ADD CONSTRAINT `mention_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mention` ADD CONSTRAINT `mention_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mention` ADD CONSTRAINT `mention_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `comment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group` ADD CONSTRAINT `group_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groupMember` ADD CONSTRAINT `groupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groupMember` ADD CONSTRAINT `groupMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `upload`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messageHide` ADD CONSTRAINT `messageHide_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messageHide` ADD CONSTRAINT `messageHide_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

