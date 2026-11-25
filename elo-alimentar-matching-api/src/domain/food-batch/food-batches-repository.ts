import type { BatchStatus, FoodBatch } from './food-batch'

/**
 * Repositório do agregado FoodBatch: carrega e salva o lote junto com as
 * ofertas. Não existe repositório de ofertas, porque oferta não é alterada
 * fora do lote.
 */
export interface FoodBatchesRepository {
  findById(id: string): Promise<FoodBatch | null>
  findByOfferId(offerId: string): Promise<FoodBatch | null>
  findMany(status?: BatchStatus): Promise<FoodBatch[]>
  /** Lotes que ainda estão na fila de ofertas: AVAILABLE ou OFFERED. */
  findManyInOfferQueue(): Promise<FoodBatch[]>
  /** Lotes com oferta em aberto (OFFERED ou RESERVED): base da carga de cada instituição. */
  findManyWithOpenOffers(): Promise<FoodBatch[]>
  /** Lotes que já foram oferecidos a esta instituição (em qualquer status). */
  findManyOfferedTo(institutionId: string): Promise<FoodBatch[]>
  create(batch: FoodBatch): Promise<void>
  /**
   * Persiste o estado atual do agregado. Se outro processo alterou o lote
   * desde a leitura (ex.: aceite e expiração ao mesmo tempo), lança um erro
   * de negócio em vez de sobrescrever.
   */
  save(batch: FoodBatch): Promise<void>
}
