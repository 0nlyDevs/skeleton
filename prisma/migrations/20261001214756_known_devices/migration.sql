-- CreateTable
CREATE TABLE `knownDevice` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deviceHash` VARCHAR(64) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `lastIp` VARCHAR(64) NULL,
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `knownDevice_userId_lastSeenAt_idx`(`userId`, `lastSeenAt`),
    UNIQUE INDEX `knownDevice_userId_deviceHash_key`(`userId`, `deviceHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `knownDevice` ADD CONSTRAINT `knownDevice_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

