import type { FoodBatchesRepository } from '@/repositories/food-batches-repository'
import type { BatchStatus, FoodBatch } from '@/matching/types'

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
