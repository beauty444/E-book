/*
  Warnings:

  - You are about to drop the column `userId` on the `author` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `author` DROP FOREIGN KEY `Author_userId_fkey`;

-- DropIndex
DROP INDEX `Author_userId_fkey` ON `author`;

-- AlterTable
ALTER TABLE `author` DROP COLUMN `userId`;
