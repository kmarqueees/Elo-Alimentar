-- Notificações no app e lembrete de prazo das ofertas.
-- CreateEnum
CREATE TYPE "NotificationRecipient" AS ENUM ('INSTITUTION', 'DONOR');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('OFFER_RECEIVED', 'OFFER_REMINDER', 'OFFER_TIMED_OUT', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'OFFER_EXPIRED', 'WAITING_FOR_INSTITUTION', 'DONATION_COLLECTED', 'BATCH_EXPIRED');

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "reminded_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipient_type" "NotificationRecipient" NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "batch_id" TEXT,
    "offer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_id_created_at_idx" ON "notifications"("recipient_id", "created_at");

