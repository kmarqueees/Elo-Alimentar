import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'
import type { Offer } from '@/domain/food-batch/offer'

interface ListBatchOffersUseCaseRequest {
  batchId: string
}

/** Histórico de ofertas de um lote (visão do doador). */
export class ListBatchOffersUseCase {
  constructor(private batchesRepository: FoodBatchesRepository) {}

  async execute({
    batchId,
  }: ListBatchOffersUseCaseRequest): Promise<{ offers: Offer[] }> {
    const batch = await this.batchesRepository.findById(batchId)

    if (!batch) {
      throw new ResourceNotFoundError()
    }

    return { offers: [...batch.offers] }
  }
}
