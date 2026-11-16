import type { FoodBatchesRepository } from '@/repositories/food-batches-repository'
import type { FoodBatch } from '@/matching/types'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface GetBatchUseCaseRequest {
  batchId: string
}

interface GetBatchUseCaseResponse {
  batch: FoodBatch
}

export class GetBatchUseCase {
  constructor(private batchesRepository: FoodBatchesRepository) {}

  async execute({
    batchId,
  }: GetBatchUseCaseRequest): Promise<GetBatchUseCaseResponse> {
    const batch = await this.batchesRepository.findById(batchId)

    if (!batch) {
      throw new ResourceNotFoundError()
    }

    return { batch }
  }
}
