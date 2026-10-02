-- AlterTable
ALTER TABLE `message` ADD COLUMN `replyToId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `room` ADD COLUMN `image` VARCHAR(200) NULL;

-- AlterTable
ALTER TABLE `roomMember` ADD COLUMN `clearedAt` DATETIME(3) NULL;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_replyToId_fkey` FOREIGN KEY (`replyToId`) REFERENCES `message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

