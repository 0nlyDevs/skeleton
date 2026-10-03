-- Rename the platform role MODERATOR to AGENT ("agent municipal"), keeping every account's role.
-- Widen the enum, move the rows, then narrow it.
ALTER TABLE `user` MODIFY `role` ENUM('USER', 'MODERATOR', 'AGENT', 'ADMIN') NOT NULL DEFAULT 'USER';
UPDATE `user` SET `role` = 'AGENT' WHERE `role` = 'MODERATOR';
ALTER TABLE `user` MODIFY `role` ENUM('USER', 'AGENT', 'ADMIN') NOT NULL DEFAULT 'USER';
