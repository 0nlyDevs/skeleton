-- CreateTable
CREATE TABLE `page` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(60) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `tagline` VARCHAR(200) NULL,
    `theme` VARCHAR(20) NOT NULL DEFAULT 'aurora',
    `font` VARCHAR(10) NOT NULL DEFAULT 'sans',
    `coverId` VARCHAR(40) NULL,
    `blocks` JSON NOT NULL,
    `visibility` ENUM('PUBLIC', 'UNLISTED') NOT NULL DEFAULT 'PUBLIC',
    `published` BOOLEAN NOT NULL DEFAULT false,
    `viewCount` INTEGER NOT NULL DEFAULT 0,
    `likeCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `page_slug_key`(`slug`),
    INDEX `page_userId_deletedAt_idx`(`userId`, `deletedAt`),
    INDEX `page_published_visibility_deletedAt_createdAt_idx`(`published`, `visibility`, `deletedAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pageMedia` (
    `pageId` VARCHAR(191) NOT NULL,
    `uploadId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `pageMedia_uploadId_key`(`uploadId`),
    PRIMARY KEY (`pageId`, `uploadId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pageLike` (
    `pageId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pageLike_userId_idx`(`userId`),
    PRIMARY KEY (`pageId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `page` ADD CONSTRAINT `page_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pageMedia` ADD CONSTRAINT `pageMedia_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `page`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pageMedia` ADD CONSTRAINT `pageMedia_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `upload`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pageLike` ADD CONSTRAINT `pageLike_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `page`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pageLike` ADD CONSTRAINT `pageLike_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

