CREATE TABLE `transportLine` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `description` VARCHAR(500) NULL,
    `stops` TEXT NOT NULL,
    `firstDeparture` VARCHAR(5) NOT NULL,
    `lastDeparture` VARCHAR(5) NOT NULL,
    `headwayMinutes` INTEGER NOT NULL,
    `serviceDays` VARCHAR(120) NOT NULL DEFAULT 'Tous les jours',
    `alert` VARCHAR(500) NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `transportLine_code_key`(`code`),
    INDEX `transportLine_published_code_idx`(`published`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Editable starter network so the citizen timetable is useful immediately.
INSERT INTO `transportLine` (`id`, `code`, `name`, `description`, `stops`, `firstDeparture`, `lastDeparture`, `headwayMinutes`, `serviceDays`, `alert`, `published`, `createdAt`, `updatedAt`) VALUES
('transport-line-demo-d', 'D', 'Dôme Central — Serres Déméter', 'Desserte des serres et du campus.', 'Dôme Central\nMarché Central\nSerres Déméter\nCampus Horizon', '05:30', '23:30', 8, 'Tous les jours', NULL, true, NOW(3), NOW(3)),
('transport-line-demo-a', 'A', 'Port — Dôme Central', 'Liaison avec le port d’arrivée.', 'Port d’arrivée\nQuartier des Pionniers\nDôme Central', '05:45', '23:00', 12, 'Tous les jours', NULL, true, NOW(3), NOW(3)),
('transport-line-demo-c', 'C', 'Clinique — Campus Horizon', 'Desserte de la clinique et du campus.', 'Clinique Nova\nPlace des Sciences\nCampus Horizon', '06:00', '22:30', 15, 'Tous les jours', NULL, true, NOW(3), NOW(3));
