-- Necessidade da instituição e limite de recebimento.

-- A capacidade passa a ser a capacidade TOTAL de armazenamento. O espaço livre
-- é calculado pelo sistema (capacidade − estoque − lotes já comprometidos).
-- RENAME preserva os valores existentes; com estoque 0, o espaço livre continua igual.
ALTER TABLE "institutions" RENAME COLUMN "available_capacity_kg" TO "storage_capacity_kg";

-- Pessoas atendidas por dia (0 = desconhecido em registros antigos: necessidade neutra).
ALTER TABLE "institutions" ADD COLUMN "people_served" INTEGER NOT NULL DEFAULT 0;

-- Último estoque conhecido e quando foi informado; o sistema desconta o consumo a partir daí.
ALTER TABLE "institutions" ADD COLUMN "stock_kg" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "institutions" ADD COLUMN "stock_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
