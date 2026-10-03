-- AlterTable
ALTER TABLE `announcement` ADD COLUMN `alertResolvedAt` DATETIME(3) NULL,
    ADD COLUMN `alertScope` ENUM('ALL', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'CRYSTAL_REACH', 'VERDANT_BASIN', 'EMBER_WASTES', 'FROSTPEAK', 'SUNKEN_DELTA', 'NOVA_PRIME', 'OBSIDIAN_COAST', 'SKYPORT_ISLES') NULL,
    ADD COLUMN `alertSeverity` ENUM('INFORMATION', 'WARNING', 'CRITICAL') NULL,
    ADD COLUMN `alertStatus` ENUM('ACTIVE', 'RESOLVED') NULL;

-- AlterTable
ALTER TABLE `notification` MODIFY `type` ENUM('NEW_MESSAGE', 'MENTION', 'SYSTEM', 'ROLE_CHANGED', 'POST_COMMENT', 'COMMENT_REPLY', 'POST_REACTION', 'NEW_FOLLOWER', 'GROUP_INVITE', 'MODERATION', 'GROUP_ACTIVITY', 'POST_SHARE', 'SECURITY', 'CITY_REQUEST', 'ANNOUNCEMENT', 'ALERT') NOT NULL DEFAULT 'SYSTEM';

-- AlterTable
ALTER TABLE `user` ADD COLUMN `cityZone` ENUM('CRYSTAL_REACH', 'VERDANT_BASIN', 'EMBER_WASTES', 'FROSTPEAK', 'SUNKEN_DELTA', 'NOVA_PRIME', 'OBSIDIAN_COAST', 'SKYPORT_ISLES') NULL;

-- CreateIndex
CREATE INDEX `announcement_category_alertStatus_publishedAt_idx` ON `announcement`(`category`, `alertStatus`, `publishedAt`);

-- CreateIndex
CREATE INDEX `announcement_alertScope_alertStatus_publishedAt_idx` ON `announcement`(`alertScope`, `alertStatus`, `publishedAt`);

-- CreateIndex
CREATE INDEX `user_cityZone_idx` ON `user`(`cityZone`);

