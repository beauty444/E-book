/*
  Warnings:

  - Added the required column `date` to the `QASession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `thumbnail` to the `QASession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `time` to the `QASession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `qasession` ADD COLUMN `date` DATETIME(3) NOT NULL,
    ADD COLUMN `thumbnail` VARCHAR(191) NOT NULL,
    ADD COLUMN `time` VARCHAR(191) NOT NULL;
