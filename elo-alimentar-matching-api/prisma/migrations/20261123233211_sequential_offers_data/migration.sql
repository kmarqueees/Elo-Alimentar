-- Separado da migration anterior porque o PostgreSQL não permite usar um valor
-- de enum recém-criado (OFFERED) na mesma transação em que ele foi adicionado.

-- Lotes que estavam RESERVED com oferta ainda sem resposta passam a OFFERED.
-- Assim a varredura de ofertas volta a acompanhá-los (expira e oferece à próxima).
UPDATE "food_batches" AS b
SET "status" = 'OFFERED'
WHERE b."status" = 'RESERVED'
  AND EXISTS (
    SELECT 1 FROM "reservations" AS r
    WHERE r."batch_id" = b."id" AND r."status" = 'PENDING'
  );
