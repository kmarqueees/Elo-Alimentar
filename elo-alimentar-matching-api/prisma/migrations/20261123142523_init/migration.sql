-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DONOR', 'RECEIVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "StorageCondition" AS ENUM ('REFRIGERATED', 'FROZEN', 'DRY');

-- CreateEnum
CREATE TYPE "FoodType" AS ENUM ('HORTIFRUTI', 'PANIFICADOS', 'PRATOS_PRONTOS', 'LATICINIOS', 'CARNES', 'NAO_PERECIVEIS');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'COLLECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DONOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "has_refrigeration" BOOLEAN NOT NULL DEFAULT false,
    "available_capacity_kg" DOUBLE PRECISION NOT NULL,
    "accepted_food_types" "FoodType"[],
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_batches" (
    "id" TEXT NOT NULL,
    "food_type" "FoodType" NOT NULL,
    "quantity_kg" DOUBLE PRECISION NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "storage_condition" "StorageCondition" NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "donor_id" TEXT NOT NULL,

    CONSTRAINT "food_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "batch_id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_user_id_key" ON "institutions"("user_id");

-- CreateIndex
CREATE INDEX "food_batches_status_expires_at_idx" ON "food_batches"("status", "expires_at");

-- CreateIndex
CREATE INDEX "reservations_batch_id_idx" ON "reservations"("batch_id");

-- CreateIndex
CREATE INDEX "reservations_institution_id_idx" ON "reservations"("institution_id");

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_batches" ADD CONSTRAINT "food_batches_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "food_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

