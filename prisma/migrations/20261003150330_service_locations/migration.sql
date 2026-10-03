-- AlterTable
ALTER TABLE `municipalService` ADD COLUMN `emergency` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mapX` INTEGER NULL,
    ADD COLUMN `mapY` INTEGER NULL,
    ADD COLUMN `zone` ENUM('CRYSTAL_REACH', 'VERDANT_BASIN', 'EMBER_WASTES', 'FROSTPEAK', 'SUNKEN_DELTA', 'NOVA_PRIME', 'OBSIDIAN_COAST', 'SKYPORT_ISLES') NULL;

-- CreateIndex
CREATE INDEX `municipalService_emergency_idx` ON `municipalService`(`emergency`);

