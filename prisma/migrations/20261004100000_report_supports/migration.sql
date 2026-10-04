-- AlterTable
ALTER TABLE `cityRequest` ADD COLUMN `supportCount` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `cityRequestSupport` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cityRequestSupport_requestId_idx`(`requestId`),
    INDEX `cityRequestSupport_userId_idx`(`userId`),
    UNIQUE INDEX `cityRequestSupport_requestId_userId_key`(`requestId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `cityRequest_issueType_zone_status_idx` ON `cityRequest`(`issueType`, `zone`, `status`);

-- AddForeignKey
ALTER TABLE `cityRequestSupport` ADD CONSTRAINT `cityRequestSupport_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `cityRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cityRequestSupport` ADD CONSTRAINT `cityRequestSupport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
