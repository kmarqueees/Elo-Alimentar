import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import { BatchNotAvailableError } from '@/domain/food-batch/errors/batch-not-available-error'
import type { FoodBatch } from '@/domain/food-batch/food-batch'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'
import type { EligibleInstitutionsRanker } from '@/domain/matching/eligible-institutions-ranker'
import { InstitutionWorkload } from '@/domain/matching/institution-workload'
import type { MatchResult } from '@/domain/matching/types'

interface MatchBatchUseCaseRequest {
  batchId: string
  now: Date
}

interface MatchBatchUseCaseResponse {
  batch: FoodBatch
  ranking: MatchResult[]
}

export class MatchBatchUseCase {
  constructor(
    private batchesRepository: FoodBatchesRepository,
    private institutionsRepository: InstitutionsRepository,
    private ranker: EligibleInstitutionsRanker,
  ) {}

  async execute({
    batchId,
    now,
  }: MatchBatchUseCaseRequest): Promise<MatchBatchUseCaseResponse> {
    const batch = await this.batchesRepository.findById(batchId)

    if (!batch) {
      throw new ResourceNotFoundError()
    }

    // Lote retirado ou vencido não tem mais fila de ofertas.
    if (!batch.isOpen) {
      throw new BatchNotAvailableError()
    }

    const institutions = await this.institutionsRepository.findManyValidated()

    const workload = InstitutionWorkload.fromBatches(await this.batchesRepository.findManyWithOpenOffers())
    const ranking = this.ranker.rank(batch, institutions, now, workload)

    return { batch, ranking }
  }
}
