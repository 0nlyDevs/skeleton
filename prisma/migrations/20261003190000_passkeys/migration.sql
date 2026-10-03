-- D02: passkeys (WebAuthn) for sign-in with the device's face, fingerprint or PIN.
-- Only public keys are stored; biometrics never leave the device.
CREATE TABLE `passkey` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `publicKey` TEXT NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `credentialID` VARCHAR(512) NOT NULL,
    `counter` INTEGER NOT NULL,
    `deviceType` VARCHAR(191) NOT NULL,
    `backedUp` BOOLEAN NOT NULL,
    `transports` VARCHAR(191) NULL,
    `aaguid` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `passkey_userId_idx`(`userId`),
    INDEX `passkey_credentialID_idx`(`credentialID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `passkey` ADD CONSTRAINT `passkey_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
