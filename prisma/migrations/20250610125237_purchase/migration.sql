/*
  Warnings:

  - You are about to drop the column `purchasesId` on the `favorite` table. All the data in the column will be lost.
  - Added the required column `favoriteId` to the `Purchase` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `favorite` DROP FOREIGN KEY `Favorite_purchasesId_fkey`;

-- DropIndex
DROP INDEX `Favorite_purchasesId_fkey` ON `favorite`;

-- AlterTable
ALTER TABLE `favorite` DROP COLUMN `purchasesId`;

-- AlterTable
ALTER TABLE `purchase` ADD COLUMN `favoriteId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_favoriteId_fkey` FOREIGN KEY (`favoriteId`) REFERENCES `Favorite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
