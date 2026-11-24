import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import type { FoodBatch } from '@/domain/food-batch/food-batch'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'

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
