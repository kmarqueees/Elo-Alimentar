import { expect, describe, it, beforeEach } from 'vitest'
import { DistanceOnlyStrategy } from '@/domain/matching/strategies/distance-only-strategy'
import { MultiCriteriaStrategy } from '@/domain/matching/strategies/multi-criteria-strategy'
import { InMemoryFoodBatchesRepository } from '@/infra/database/in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '@/infra/database/in-memory/in-memory-institutions-repository'
import { makeFoodBatch } from '@/test/factories/make-food-batch'
import { makeInstitution } from '@/test/factories/make-institution'
import { CompareStrategiesUseCase } from './compare-strategies'

let batchesRepository: InMemoryFoodBatchesRepository
let institutionsRepository: InMemoryInstitutionsRepository
let sut: CompareStrategiesUseCase

const now = new Date('2026-10-16T12:00:00Z')
const KM = 0.009

describe('Compare Strategies Use Case', () => {
  beforeEach(() => {
    batchesRepository = new InMemoryFoodBatchesRepository()
    institutionsRepository = new InMemoryInstitutionsRepository()

    sut = new CompareStrategiesUseCase(
      batchesRepository,
      institutionsRepository,
      [new DistanceOnlyStrategy(), new MultiCriteriaStrategy()],
    )
  })

  it('should show the multicriteria strategy saving the batch the baseline loses', async () => {
    await batchesRepository.create(
      makeFoodBatch({
        donorId: 'donor-01',
        foodType: 'HORTIFRUTI',
        quantityKg: 10,
        expiresAt: new Date('2026-10-16T13:00:00Z'),
        storageCondition: 'REFRIGERATED',
        latitude: -3.1,
        longitude: -60.0,
      }),
    )

    await institutionsRepository.create(
      makeInstitution({
        name: 'near-no-fridge',
        latitude: -3.1 + 1 * KM,
        longitude: -60.0,
        hasRefrigeration: false,
        availableCapacityKg: 100,
        acceptedFoodTypes: [],
        validated: true,
      }),
    )
    await institutionsRepository.create(
      makeInstitution({
        name: 'far-with-fridge',
        latitude: -3.1 + 4 * KM,
        longitude: -60.0,
        hasRefrigeration: true,
        availableCapacityKg: 100,
        acceptedFoodTypes: [],
        validated: true,
      }),
    )

    const result = await sut.execute({ now })

    const baseline = result.summaries.find((s) => s.strategy === 'Somente distância')!
    const multi = result.summaries.find((s) => s.strategy === 'Multicritério')!

    expect(baseline.firstChoiceViableRate).toEqual(0)
    expect(multi.firstChoiceViableRate).toEqual(1)

    expect(baseline.collectedBatches).toEqual(1)
    expect(multi.collectedBatches).toEqual(1)

    expect(baseline.averageMinutesToPickup).toBeCloseTo(38, 0)
    expect(multi.averageMinutesToPickup).toBeCloseTo(8, 0)
    expect(result.timeReductionPercent).toBeGreaterThan(70)
  })

  it('should count a batch as lost when no institution can take it in time', async () => {
    await batchesRepository.create(
      makeFoodBatch({
        donorId: 'donor-01',
        foodType: 'CARNES',
        quantityKg: 10,
        expiresAt: new Date('2026-10-16T12:10:00Z'),
        storageCondition: 'FROZEN',
        latitude: -3.1,
        longitude: -60.0,
      }),
    )

    await institutionsRepository.create(
      makeInstitution({
        name: 'no-fridge',
        latitude: -3.1 + 1 * KM,
        longitude: -60.0,
        hasRefrigeration: false,
        availableCapacityKg: 100,
        acceptedFoodTypes: [],
        validated: true,
      }),
    )

    const result = await sut.execute({ now })

    for (const summary of result.summaries) {
      expect(summary.collectedBatches).toEqual(0)
      expect(summary.collectionRate).toEqual(0)
    }

    expect(result.timeReductionPercent).toBeNull()
  })

  it('should return empty summaries safely when there are no batches', async () => {
    const result = await sut.execute({ now })

    expect(result.perBatch).toEqual([])
    expect(result.summaries[0]?.collectionRate).toEqual(0)
    expect(result.summaries[0]?.averageMinutesToPickup).toBeNull()
  })
})
