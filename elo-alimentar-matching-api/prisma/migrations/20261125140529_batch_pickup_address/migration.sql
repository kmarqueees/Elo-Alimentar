-- Endereço de retirada do lote. Colunas opcionais: lotes antigos e os marcados só no mapa ficam sem endereço.
-- AlterTable
ALTER TABLE "food_batches" ADD COLUMN     "address_city" TEXT,
ADD COLUMN     "address_complement" TEXT,
ADD COLUMN     "address_district" TEXT,
ADD COLUMN     "address_number" TEXT,
ADD COLUMN     "address_postal_code" CHAR(8),
ADD COLUMN     "address_state" CHAR(2),
ADD COLUMN     "address_street" TEXT;

