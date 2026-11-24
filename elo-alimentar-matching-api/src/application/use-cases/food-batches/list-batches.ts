import type { BatchStatus, FoodBatch } from '@/domain/food-batch/food-batch'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'

interface ListBatchesUseCaseRequest {
  status?: BatchStatus
}

interface ListBatchesUseCaseResponse {
  batches: FoodBatch[]
}

export class ListBatchesUseCase {
  constructor(private batchesRepository: FoodBatchesRepository) {}

  async execute({
    status,
  }: ListBatchesUseCaseRequest = {}): Promise<ListBatchesUseCaseResponse> {
    const batches = await this.batchesRepository.findMany(status)

    return { batches }
  }
}
