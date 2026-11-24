import { expect, describe, it, beforeEach } from 'vitest'
import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import { BatchNotAvailableError } from '@/domain/food-batch/errors/batch-not-available-error'
import type { BatchStatus } from '@/domain/food-batch/food-batch'
import { EligibleInstitutionsRanker } from '@/domain/matching/eligible-institutions-ranker'
import { DistanceOnlyStrategy } from '@/domain/matching/strategies/distance-only-strategy'
import { MultiCriteriaStrategy } from '@/domain/matching/strategies/multi-criteria-strategy'
import type { MatchingStrategy } from '@/domain/matching/types'
import { InMemoryFoodBatchesRepository } from '@/infra/database/in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '@/infra/database/in-memory/in-memory-institutions-repository'
import { makeFoodBatch } from '@/test/factories/make-food-batch'
import { makeInstitution } from '@/test/factories/make-institution'
import { MatchBatchUseCase } from './match-batch'

let batchesRepository: InMemoryFoodBatchesRepository
let institutionsRepository: InMemoryInstitutionsRepository

const now = new Date('2026-10-16T12:00:00Z')
const KM = 0.009

async function seedBatch(status: BatchStatus = 'AVAILABLE') {
  const batch = makeFoodBatch({
    donorId: 'donor-01',
    foodType: 'HORTIFRUTI',
    quantityKg: 18,
    expiresAt: new Date('2026-10-16T14:00:00Z'),
    storageCondition: 'REFRIGERATED',
    latitude: -3.1,
    longitude: -60.0,
    status,
  })

  await batchesRepository.create(batch)

  return batch
}

function institution(id: string, kmAway: number, overrides = {}) {
  return institutionsRepository.create(
    makeInstitution({
      id,
      name: id,
      latitude: -3.1 + kmAway * KM,
      longitude: -60.0,
      hasRefrigeration: true,
      availableCapacityKg: 100,
      acceptedFoodTypes: [],
      validated: true,
      ...overrides,
    }),
  )
}

function makeSut(strategy: MatchingStrategy) {
  return new MatchBatchUseCase(
    batchesRepository,
    institutionsRepository,
    new EligibleInstitutionsRanker(strategy),
  )
}

describe('Match Batch Use Case', () => {
  beforeEach(() => {
    batchesRepository = new InMemoryFoodBatchesRepository()
    institutionsRepository = new InMemoryInstitutionsRepository()
  })

  it('should return a ranking for an available batch', async () => {
    const batch = await seedBatch()
    await institution('near', 1)
    await institution('far', 6)

    const sut = makeSut(new MultiCriteriaStrategy())

    const { ranking } = await sut.execute({ batchId: batch.id, now })

    expect(ranking.map((r) => r.institution.id)).toEqual(['near', 'far'])
  })

  it('should ignore institutions not validated by the admin (RN03)', async () => {
    const batch = await seedBatch()
    await institution('validated', 3)
    await institution('pending', 1, { validated: false })

    const sut = makeSut(new MultiCriteriaStrategy())

    const { ranking } = await sut.execute({ batchId: batch.id, now })

    expect(ranking.map((r) => r.institution.id)).toEqual(['validated'])
  })

  it('should apply whichever strategy is injected', async () => {
    const batch = await seedBatch()
    await institution('near-no-fridge', 1, { hasRefrigeration: false })
    await institution('far-with-fridge', 4)

    const baseline = makeSut(new DistanceOnlyStrategy())
    const multi = makeSut(new MultiCriteriaStrategy())

    const baselineResult = await baseline.execute({ batchId: batch.id, now })
    const multiResult = await multi.execute({ batchId: batch.id, now })

    expect(baselineResult.ranking[0]?.institution.id).toEqual('near-no-fridge')
    expect(multiResult.ranking[0]?.institution.id).toEqual('far-with-fridge')
  })

  it('should throw when the batch does not exist', async () => {
    const sut = makeSut(new MultiCriteriaStrategy())

    await expect(() =>
      sut.execute({ batchId: 'missing', now }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  it('should throw when the batch was already collected', async () => {
    const batch = await seedBatch('COLLECTED')

    const sut = makeSut(new MultiCriteriaStrategy())

    await expect(() =>
      sut.execute({ batchId: batch.id, now }),
    ).rejects.toBeInstanceOf(BatchNotAvailableError)
  })
})
