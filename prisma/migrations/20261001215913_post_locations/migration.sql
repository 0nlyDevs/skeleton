-- AlterTable
ALTER TABLE `post` ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL,
    ADD COLUMN `placeName` VARCHAR(160) NULL;

-- CreateIndex
CREATE INDEX `post_latitude_longitude_idx` ON `post`(`latitude`, `longitude`);

