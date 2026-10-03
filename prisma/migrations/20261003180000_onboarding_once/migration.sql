-- D12: the welcome guide opens once per account, not once per browser.
ALTER TABLE `user` ADD COLUMN `onboardingCompletedAt` DATETIME(3) NULL;

-- Accounts that already exist have been through the platform: the guide no
-- longer opens for them by itself (it stays available from the top bar).
UPDATE `user` SET `onboardingCompletedAt` = CURRENT_TIMESTAMP(3);
