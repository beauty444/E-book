/*
  Warnings:

  - You are about to drop the column `isFollowed` on the `author` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `author` DROP COLUMN `isFollowed`;

-- AlterTable
ALTER TABLE `follow` ADD COLUMN `isFollowed` BOOLEAN NOT NULL DEFAULT true;
