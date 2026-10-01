-- Re-signalling after resolution.
--
-- The old composite unique index made a flag permanent: even after staff
-- resolved or dismissed it, the reporter could never flag that target again,
-- so a reoffending post stayed unreportable by the person who caught it first.
--
-- `duplicateKey` holds `(reporter, target)` only while the report is OPEN.
-- Resolution clears it, and MySQL treats each NULL as distinct in a unique
-- index, so: duplicate concurrent flags still collide (the guarantee the old
-- constraint gave), but a fresh flag after resolution is accepted.

-- The composite unique index was the only index starting with `reporterId`,
-- and MySQL/MariaDB refuse to drop an index a foreign key depends on
-- (error 1553). The plain index takes over that role first.
CREATE INDEX `report_reporterId_idx` ON `report`(`reporterId`);

DROP INDEX `report_reporterId_targetType_targetId_key` ON `report`;

ALTER TABLE `report` ADD COLUMN `duplicateKey` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `report_duplicateKey_key` ON `report`(`duplicateKey`);
