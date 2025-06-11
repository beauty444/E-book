/*
  Warnings:

  - You are about to drop the column `amount` on the `purchase` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[purchaseId]` on the table `Purchase` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `price` to the `Purchase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `purchaseId` to the `Purchase` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `purchase` DROP COLUMN `amount`,
    ADD COLUMN `authorEarning` DOUBLE NULL,
    ADD COLUMN `commissionAmount` DOUBLE NULL,
    ADD COLUMN `costPrice` DOUBLE NULL,
    ADD COLUMN `discount` DOUBLE NULL,
    ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `price` DOUBLE NOT NULL,
    ADD COLUMN `purchaseId` VARCHAR(191) NOT NULL,
    ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'paid';

-- CreateIndex
CREATE UNIQUE INDEX `Purchase_purchaseId_key` ON `Purchase`(`purchaseId`);
