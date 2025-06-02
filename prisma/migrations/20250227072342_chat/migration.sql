/*
  Warnings:

  - You are about to drop the column `isLinkId` on the `chatmessage` table. All the data in the column will be lost.
  - You are about to drop the column `isUrl` on the `chatmessage` table. All the data in the column will be lost.
  - You are about to drop the column `coachId` on the `chatparticipant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[chatId,userId,authorId]` on the table `ChatParticipant` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `chatparticipant` DROP FOREIGN KEY `ChatParticipant_coachId_fkey`;

-- DropIndex
DROP INDEX `ChatParticipant_coachId_fkey` ON `chatparticipant`;

-- AlterTable
ALTER TABLE `chatmessage` DROP COLUMN `isLinkId`,
    DROP COLUMN `isUrl`,
    ADD COLUMN `fileName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `chatparticipant` DROP COLUMN `coachId`,
    ADD COLUMN `authorId` INTEGER NULL;

-- CreateTable
CREATE TABLE `AuthorActivateChat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `authorId` INTEGER NOT NULL,
    `chatId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthorUnreadCount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `authorId` INTEGER NOT NULL,
    `chatId` INTEGER NOT NULL,
    `unreadCount` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ChatParticipant_chatId_userId_authorId_key` ON `ChatParticipant`(`chatId`, `userId`, `authorId`);

-- AddForeignKey
ALTER TABLE `ChatParticipant` ADD CONSTRAINT `ChatParticipant_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Author`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorActivateChat` ADD CONSTRAINT `AuthorActivateChat_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Author`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorActivateChat` ADD CONSTRAINT `AuthorActivateChat_chatId_fkey` FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorUnreadCount` ADD CONSTRAINT `AuthorUnreadCount_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Author`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthorUnreadCount` ADD CONSTRAINT `AuthorUnreadCount_chatId_fkey` FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
