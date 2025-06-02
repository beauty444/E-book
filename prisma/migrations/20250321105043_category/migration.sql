/*
  Warnings:

  - You are about to drop the column `authorId` on the `bookcategory` table. All the data in the column will be lost.
  - Made the column `bookId` on table `bookcategory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `categoryId` on table `bookcategory` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `bookcategory` DROP FOREIGN KEY `BookCategory_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `bookcategory` DROP FOREIGN KEY `BookCategory_bookId_fkey`;

-- DropForeignKey
ALTER TABLE `bookcategory` DROP FOREIGN KEY `BookCategory_categoryId_fkey`;

-- DropIndex
DROP INDEX `BookCategory_authorId_fkey` ON `bookcategory`;

-- DropIndex
DROP INDEX `BookCategory_categoryId_fkey` ON `bookcategory`;

-- AlterTable
ALTER TABLE `bookcategory` DROP COLUMN `authorId`,
    MODIFY `bookId` INTEGER NOT NULL,
    MODIFY `categoryId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `BookCategory` ADD CONSTRAINT `BookCategory_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookCategory` ADD CONSTRAINT `BookCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
