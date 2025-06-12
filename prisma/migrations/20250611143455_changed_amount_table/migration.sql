/*
  Warnings:

  - You are about to alter the column `amount` on the `subscription` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Double`.

*/
-- AlterTable
ALTER TABLE `subscription` MODIFY `amount` DOUBLE NULL;
