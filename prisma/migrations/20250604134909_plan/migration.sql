/*
  Warnings:

  - You are about to drop the column `type` on the `plan` table. All the data in the column will be lost.
  - Added the required column `duration` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `plan` DROP COLUMN `type`,
    ADD COLUMN `duration` VARCHAR(191) NOT NULL;
