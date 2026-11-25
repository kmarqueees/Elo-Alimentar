import type { BatchStatus, FoodBatch } from '@/domain/food-batch/food-batch'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'

/**
 * Guarda as próprias instâncias do agregado. Não há regra de negócio aqui:
 * as transições de status acontecem na entidade, e o save só persiste.
 */
export class InMemoryFoodBatchesRepository implements FoodBatchesRepository {
  public items: FoodBatch[] = []

  async findById(id: string) {
    return this.items.find((item) => item.id === id) ?? null
  }

  async findByOfferId(offerId: string) {
    return (
      this.items.find((item) => item.offers.some((offer) => offer.id === offerId)) ?? null
    )
  }

  async findMany(status?: BatchStatus) {
    return this.items.filter((item) => !status || item.status === status)
  }

  async findManyInOfferQueue() {
    return this.items.filter(
      (item) => item.status === 'AVAILABLE' || item.status === 'OFFERED',
    )
  }

  async findManyWithOpenOffers() {
    return this.items.filter(
      (item) => item.status === 'OFFERED' || item.status === 'RESERVED',
    )
  }

  async findManyOfferedTo(institutionId: string) {
    return this.items.filter((item) =>
      item.offers.some((offer) => offer.institutionId === institutionId),
    )
  }

  async create(batch: FoodBatch) {
    this.items.push(batch)
  }

  async save(batch: FoodBatch) {
    const index = this.items.findIndex((item) => item.id === batch.id)

    if (index >= 0) {
      this.items[index] = batch
    }
  }
}
