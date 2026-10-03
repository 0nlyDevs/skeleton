-- F71: accounts created by an agent for residents without an email address.
ALTER TABLE `user` ADD COLUMN `noEmail` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mustSetSecret` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `preferredLocale` VARCHAR(5) NULL;
