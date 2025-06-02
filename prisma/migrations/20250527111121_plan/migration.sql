/*
  Warnings:

  - You are about to drop the column `amount` on the `plan` table. All the data in the column will be lost.
  - You are about to drop the column `assetPromote` on the `plan` table. All the data in the column will be lost.
  - You are about to drop the column `editAssetName` on the `plan` table. All the data in the column will be lost.
  - You are about to drop the column `initiate_chat` on the `plan` table. All the data in the column will be lost.
  - You are about to drop the column `plan_days` on the `plan` table. All the data in the column will be lost.
  - You are about to drop the column `plan_name` on the `plan` table. All the data in the column will be lost.
  - You are about to drop the column `plan_type` on the `plan` table. All the data in the column will be lost.
  - You are about to drop the column `reportAsset` on the `plan` table. All the data in the column will be lost.
  - You are about to drop the column `reportProfile` on the `plan` table. All the data in the column will be lost.
  - You are about to drop the `usersubscription` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `name` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `usersubscription` DROP FOREIGN KEY `UserSubscription_planId_fkey`;

-- DropForeignKey
ALTER TABLE `usersubscription` DROP FOREIGN KEY `UserSubscription_userId_fkey`;

-- AlterTable
ALTER TABLE `plan` DROP COLUMN `amount`,
    DROP COLUMN `assetPromote`,
    DROP COLUMN `editAssetName`,
    DROP COLUMN `initiate_chat`,
    DROP COLUMN `plan_days`,
    DROP COLUMN `plan_name`,
    DROP COLUMN `plan_type`,
    DROP COLUMN `reportAsset`,
    DROP COLUMN `reportProfile`,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `price` DOUBLE NOT NULL,
    ADD COLUMN `type` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `usersubscription`;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `authorId` INTEGER NOT NULL,
    `planId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `startDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endDate` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BankInfo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accountId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `bankInfo` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `authorId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Author`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankInfo` ADD CONSTRAINT `BankInfo_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Author`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
