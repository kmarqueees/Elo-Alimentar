import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryFoodBatchesRepository } from '@/repositories/in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '@/repositories/in-memory/in-memory-institutions-repository'
import { InMemoryReservationsRepository } from '@/repositories/in-memory/in-memory-reservations-repository'
import { MatchBatchUseCase } from './match-batch'
import { MultiCriteriaStrategy } from '@/matching/strategies/multi-criteria-strategy'
import { DistanceOnlyStrategy } from '@/matching/strategies/distance-only-strategy'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { BatchNotAvailableError } from './errors/batch-not-available-error'

let batchesRepository: InMemoryFoodBatchesRepository
let institutionsRepository: InMemoryInstitutionsRepository
let reservationsRepository: InMemoryReservationsRepository

const now = new Date('2026-10-16T12:00:00Z')
const KM = 0.009

async function seedBatch() {
  return batchesRepository.create({
    donorId: 'donor-01',
    foodType: 'HORTIFRUTI',
    quantityKg: 18,
    expiresAt: new Date('2026-10-16T14:00:00Z'),
    storageCondition: 'REFRIGERATED',
    latitude: -3.1,
    longitude: -60.0,
  })
}

function institution(id: string, kmAway: number, overrides = {}) {
  return institutionsRepository.create({
    id,
    name: id,
    latitude: -3.1 + kmAway * KM,
    longitude: -60.0,
    hasRefrigeration: true,
    availableCapacityKg: 100,
    acceptedFoodTypes: [],
    validated: true,
    ...overrides,
  })
}

describe('Match Batch Use Case', () => {
  beforeEach(() => {
    batchesRepository = new InMemoryFoodBatchesRepository()
    institutionsRepository = new InMemoryInstitutionsRepository()
    reservationsRepository = new InMemoryReservationsRepository(batchesRepository)
  })

  it('should return a ranking for an available batch', async () => {
    const batch = await seedBatch()
    await institution('near', 1)
    await institution('far', 6)

    const sut = new MatchBatchUseCase(
      batchesRepository,
      institutionsRepository,
      new MultiCriteriaStrategy(),
      reservationsRepository,
    )

    const { ranking } = await sut.execute({ batchId: batch.id, now })

    expect(ranking.map((r) => r.institution.id)).toEqual(['near', 'far'])
  })

  it('should ignore institutions not validated by the admin (RN03)', async () => {
    const batch = await seedBatch()
    await institution('validated', 3)
    await institution('pending', 1, { validated: false })

    const sut = new MatchBatchUseCase(
      batchesRepository,
      institutionsRepository,
      new MultiCriteriaStrategy(),
      reservationsRepository,
    )

    const { ranking } = await sut.execute({ batchId: batch.id, now })

    expect(ranking.map((r) => r.institution.id)).toEqual(['validated'])
  })

  it('should apply whichever strategy is injected', async () => {
    const batch = await seedBatch()
    await institution('near-no-fridge', 1, { hasRefrigeration: false })
    await institution('far-with-fridge', 4)

    const baseline = new MatchBatchUseCase(
      batchesRepository,
      institutionsRepository,
      new DistanceOnlyStrategy(),
      reservationsRepository,
    )
    const multi = new MatchBatchUseCase(
      batchesRepository,
      institutionsRepository,
      new MultiCriteriaStrategy(),
      reservationsRepository,
    )

    const baselineResult = await baseline.execute({ batchId: batch.id, now })
    const multiResult = await multi.execute({ batchId: batch.id, now })

    expect(baselineResult.ranking[0]?.institution.id).toEqual('near-no-fridge')
    expect(multiResult.ranking[0]?.institution.id).toEqual('far-with-fridge')
  })

  it('should throw when the batch does not exist', async () => {
    const sut = new MatchBatchUseCase(
      batchesRepository,
      institutionsRepository,
      new MultiCriteriaStrategy(),
      reservationsRepository,
    )

    await expect(() =>
      sut.execute({ batchId: 'missing', now }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  it('should throw when the batch is no longer available', async () => {
    const batch = await seedBatch()
    batch.status = 'RESERVED'

    const sut = new MatchBatchUseCase(
      batchesRepository,
      institutionsRepository,
      new MultiCriteriaStrategy(),
      reservationsRepository,
    )

    await expect(() =>
      sut.execute({ batchId: batch.id, now }),
    ).rejects.toBeInstanceOf(BatchNotAvailableError)
  })
})
