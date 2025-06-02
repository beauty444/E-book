/*
  Warnings:

  - You are about to drop the column `authorId` on the `authornotification` table. All the data in the column will be lost.
  - You are about to drop the column `body` on the `authornotification` table. All the data in the column will be lost.
  - You are about to drop the column `senderId` on the `authornotification` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `authornotification` table. All the data in the column will be lost.
  - Added the required column `toUserId` to the `AuthorNotification` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `authornotification` DROP FOREIGN KEY `AuthorNotification_authorId_fkey`;

-- DropIndex
DROP INDEX `AuthorNotification_authorId_fkey` ON `authornotification`;

-- AlterTable
ALTER TABLE `authornotification` DROP COLUMN `authorId`,
    DROP COLUMN `body`,
    DROP COLUMN `senderId`,
    DROP COLUMN `title`,
    ADD COLUMN `byAdminId` INTEGER NULL,
    ADD COLUMN `byUserId` INTEGER NULL,
    ADD COLUMN `content` VARCHAR(191) NULL,
    ADD COLUMN `data` JSON NULL,
    ADD COLUMN `followStatus` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `toAuthorId` INTEGER NULL,
    ADD COLUMN `toUserId` INTEGER NOT NULL,
    MODIFY `type` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `AuthorNotification` ADD CONSTRAINT `AuthorNotification_byUserId_fkey` FOREIGN KEY (`byUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorNotification` ADD CONSTRAINT `AuthorNotification_byAdminId_fkey` FOREIGN KEY (`byAdminId`) REFERENCES `Admin`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorNotification` ADD CONSTRAINT `AuthorNotification_toAuthorId_fkey` FOREIGN KEY (`toAuthorId`) REFERENCES `Author`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
