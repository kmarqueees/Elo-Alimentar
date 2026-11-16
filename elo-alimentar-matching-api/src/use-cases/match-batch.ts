import type { FoodBatchesRepository } from '@/repositories/food-batches-repository'
import type { InstitutionsRepository } from '@/repositories/institutions-repository'
import type { ReservationsRepository } from '@/repositories/reservations-repository'
import type { FoodBatch, MatchingStrategy, MatchResult } from '@/matching/types'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { BatchNotAvailableError } from './errors/batch-not-available-error'

interface MatchBatchUseCaseRequest {
  batchId: string
  now?: Date
}

interface MatchBatchUseCaseResponse {
  batch: FoodBatch
  ranking: MatchResult[]
}

export class MatchBatchUseCase {
  constructor(
    private batchesRepository: FoodBatchesRepository,
    private institutionsRepository: InstitutionsRepository,
    private strategy: MatchingStrategy,
    private reservationsRepository: ReservationsRepository,
  ) {}

  async execute({
    batchId,
    now = new Date(),
  }: MatchBatchUseCaseRequest): Promise<MatchBatchUseCaseResponse> {
    const batch = await this.batchesRepository.findById(batchId)

    if (!batch) {
      throw new ResourceNotFoundError()
    }

    if (batch.status !== 'AVAILABLE') {
      throw new BatchNotAvailableError()
    }

    const attempts = await this.reservationsRepository.findManyByBatchId(batch.id)
    const alreadyTried = new Set(
      attempts
        .filter((item) => item.status === 'CANCELLED' || item.status === 'EXPIRED')
        .map((item) => item.institutionId),
    )

    const validated = await this.institutionsRepository.findManyValidated()
    const institutions = validated.filter((item) => !alreadyTried.has(item.id))

    const ranking = this.strategy.rank(batch, institutions, now)

    return { batch, ranking }
  }
}
