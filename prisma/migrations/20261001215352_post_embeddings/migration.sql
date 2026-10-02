-- CreateTable
CREATE TABLE `postEmbedding` (
    `postId` VARCHAR(191) NOT NULL,
    `model` VARCHAR(120) NOT NULL,
    `vector` LONGBLOB NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `postEmbedding_model_idx`(`model`),
    PRIMARY KEY (`postId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `postEmbedding` ADD CONSTRAINT `postEmbedding_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

