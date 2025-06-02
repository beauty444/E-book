/*
  Warnings:

  - You are about to drop the column `followStatus` on the `authornotification` table. All the data in the column will be lost.
  - You are about to drop the column `toUserId` on the `authornotification` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `authornotification` DROP COLUMN `followStatus`,
    DROP COLUMN `toUserId`;
