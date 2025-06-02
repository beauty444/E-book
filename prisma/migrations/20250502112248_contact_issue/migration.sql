/*
  Warnings:

  - You are about to drop the column `user` on the `contactissue` table. All the data in the column will be lost.
  - Added the required column `name` to the `ContactIssue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ContactIssue` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `contactissue` DROP COLUMN `user`,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `userId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `ContactIssue` ADD CONSTRAINT `ContactIssue_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
