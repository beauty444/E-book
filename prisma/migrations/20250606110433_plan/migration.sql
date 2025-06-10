/*
  Warnings:

  - Added the required column `features` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `plan` ADD COLUMN `features` JSON NOT NULL;
