-- Oferta sequencial: o lote é oferecido a uma instituição por vez, na ordem do ranking.

-- Novo status do lote: oferecido a uma instituição, aguardando a resposta dela.
ALTER TYPE "BatchStatus" ADD VALUE 'OFFERED' BEFORE 'RESERVED';

-- As reservas viram ofertas. RENAME VALUE preserva os registros existentes.
ALTER TYPE "ReservationStatus" RENAME VALUE 'CONFIRMED' TO 'ACCEPTED';
ALTER TYPE "ReservationStatus" RENAME VALUE 'CANCELLED' TO 'DECLINED';
