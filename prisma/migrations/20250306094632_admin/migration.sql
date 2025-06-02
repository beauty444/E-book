/*
  Warnings:

  - You are about to drop the column `full_name` on the `admin` table. All the data in the column will be lost.
  - Added the required column `fullName` to the `Admin` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `admin` DROP COLUMN `full_name`,
    ADD COLUMN `fullName` VARCHAR(191) NOT NULL;
