/*
  Warnings:

  - You are about to drop the column `favoriteId` on the `purchase` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `purchase` DROP FOREIGN KEY `Purchase_favoriteId_fkey`;

-- DropIndex
DROP INDEX `Purchase_favoriteId_fkey` ON `purchase`;

-- AlterTable
ALTER TABLE `purchase` DROP COLUMN `favoriteId`;
