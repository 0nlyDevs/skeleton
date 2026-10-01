-- AlterTable
ALTER TABLE `user` ADD COLUMN `birthDate` DATE NULL,
    ADD COLUMN `displayUsername` VARCHAR(30) NULL,
    ADD COLUMN `firstName` VARCHAR(50) NULL,
    ADD COLUMN `lastName` VARCHAR(50) NULL,
    ADD COLUMN `username` VARCHAR(30) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `user_username_key` ON `user`(`username`);


-- Backfill: every existing account gets a unique, valid handle derived from
-- its id (the id is unique, so the handle is too). Users can rename it from
-- their profile. Names are split on the first space as a best effort.
UPDATE `user`
SET `username` = LOWER(CONCAT('user_', SUBSTRING(REPLACE(REPLACE(`id`, '-', ''), '_', ''), 1, 12))),
    `displayUsername` = LOWER(CONCAT('user_', SUBSTRING(REPLACE(REPLACE(`id`, '-', ''), '_', ''), 1, 12)))
WHERE `username` IS NULL;

UPDATE `user`
SET `firstName` = LEFT(SUBSTRING_INDEX(`name`, ' ', 1), 50),
    `lastName` = NULLIF(LEFT(TRIM(SUBSTRING(`name`, LENGTH(SUBSTRING_INDEX(`name`, ' ', 1)) + 1)), 50), '')
WHERE `firstName` IS NULL;
