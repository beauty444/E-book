/*
  Warnings:

  - You are about to drop the column `authorName` on the `author` table. All the data in the column will be lost.
  - You are about to drop the column `videoUrl` on the `book` table. All the data in the column will be lost.
  - You are about to drop the `socialmedia` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `dob` to the `Author` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `socialmedia` DROP FOREIGN KEY `SocialMedia_authorId_fkey`;

-- AlterTable
ALTER TABLE `author` DROP COLUMN `authorName`,
    ADD COLUMN `dob` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `book` DROP COLUMN `videoUrl`;

-- DropTable
DROP TABLE `socialmedia`;
