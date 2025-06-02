/*
  Warnings:

  - You are about to drop the column `date` on the `contactissue` table. All the data in the column will be lost.
  - Added the required column `subject` to the `ContactIssue` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `contactissue` DROP COLUMN `date`,
    ADD COLUMN `subject` VARCHAR(191) NOT NULL;
