import { expect, describe, it } from 'vitest'
import { DistanceOnlyStrategy } from './distance-only-strategy'
import { MultiCriteriaStrategy } from './multi-criteria-strategy'
import { DEFAULT_MATCHING_CONFIG } from '../config'
import type { MatchableBatch, MatchableInstitution } from '../types'

const now = new Date('2026-10-16T12:00:00Z')

const KM = 0.009

function makeBatch(overrides: Partial<MatchableBatch> = {}): MatchableBatch {
  return {
    foodType: 'HORTIFRUTI',
    quantityKg: 18,
    expiresAt: new Date('2026-10-16T14:00:00Z'),
    storageCondition: 'REFRIGERATED',
    latitude: -3.1,
    longitude: -60.0,
    ...overrides,
  }
}

function makeInstitution(
  id: string,
  kmAway: number,
  overrides: Partial<MatchableInstitution> = {},
): MatchableInstitution {
  return {
    id,
    name: id,
    latitude: -3.1 + kmAway * KM,
    longitude: -60.0,
    hasRefrigeration: true,
    availableCapacityKg: 100,
    acceptedFoodTypes: [],
    ...overrides,
  }
}

describe('DistanceOnlyStrategy (baseline)', () => {
  it('should rank by distance only, ignoring refrigeration', () => {
    const near = makeInstitution('near-no-fridge', 1, { hasRefrigeration: false })
    const far = makeInstitution('far-with-fridge', 4)

    const ranking = new DistanceOnlyStrategy().rank(makeBatch(), [far, near])

    expect(ranking[0]?.institution.id).toEqual('near-no-fridge')
  })
})

describe('MultiCriteriaStrategy', () => {
  const sut = new MultiCriteriaStrategy()

  it('should exclude institutions without refrigeration for refrigerated batches (RN01)', () => {
    const near = makeInstitution('near-no-fridge', 1, { hasRefrigeration: false })
    const far = makeInstitution('far-with-fridge', 4)

    const ranking = sut.rank(makeBatch(), [near, far], now)

    expect(ranking.map((r) => r.institution.id)).toEqual(['far-with-fridge'])
  })

  it('should keep institutions without refrigeration for dry batches', () => {
    const near = makeInstitution('near-no-fridge', 1, { hasRefrigeration: false })

    const ranking = sut.rank(
      makeBatch({ storageCondition: 'DRY' }),
      [near],
      now,
    )

    expect(ranking).toHaveLength(1)
  })

  it('should exclude institutions that cannot arrive before the batch expires', () => {
    const tooFar = makeInstitution('too-far', 70)
    const reachable = makeInstitution('reachable', 10)

    const ranking = sut.rank(makeBatch(), [tooFar, reachable], now)

    expect(ranking.map((r) => r.institution.id)).toEqual(['reachable'])
  })

  it('should exclude institutions where travel time exceeds the remaining validity, even inside the radius', () => {
    const batch = makeBatch({ expiresAt: new Date('2026-10-16T12:20:00Z') })
    const tooSlow = makeInstitution('too-slow', 12)
    const closeEnough = makeInstitution('close-enough', 3)

    const ranking = sut.rank(batch, [tooSlow, closeEnough], now)

    expect(ranking.map((r) => r.institution.id)).toEqual(['close-enough'])
  })

  it('should return an empty ranking for an already expired batch', () => {
    const batch = makeBatch({ expiresAt: new Date('2026-10-16T11:00:00Z') })

    expect(sut.rank(batch, [makeInstitution('a', 1)], now)).toEqual([])
  })

  it('should rank the closer institution first when everything else is equal', () => {
    const near = makeInstitution('near', 1)
    const far = makeInstitution('far', 6)

    const ranking = sut.rank(makeBatch(), [far, near], now)

    expect(ranking.map((r) => r.institution.id)).toEqual(['near', 'far'])
    expect(ranking[0]!.score).toBeGreaterThan(ranking[1]!.score)
  })

  it('should prefer an institution with enough capacity over one that cannot hold the batch', () => {
    const small = makeInstitution('small', 2, { availableCapacityKg: 5 })
    const big = makeInstitution('big', 2, { availableCapacityKg: 200 })

    const ranking = sut.rank(makeBatch(), [small, big], now)

    expect(ranking[0]?.institution.id).toEqual('big')
  })

  it('should prefer an institution whose demand profile accepts the food type', () => {
    const wrongProfile = makeInstitution('wrong-profile', 2, {
      acceptedFoodTypes: ['PANIFICADOS'],
    })
    const rightProfile = makeInstitution('right-profile', 2, {
      acceptedFoodTypes: ['HORTIFRUTI'],
    })

    const ranking = sut.rank(makeBatch(), [wrongProfile, rightProfile], now)

    expect(ranking[0]?.institution.id).toEqual('right-profile')
  })

  it('should keep scores between 0 and 1', () => {
    const ranking = sut.rank(
      makeBatch(),
      [makeInstitution('a', 0), makeInstitution('b', 5), makeInstitution('c', 14)],
      now,
    )

    for (const result of ranking) {
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(1)
    }
  })

  describe('urgency weight (RN02)', () => {
    it('should give the urgency factor its full weight below 24h', () => {
      expect(sut.urgencyIntensity(6)).toEqual(1)
      expect(sut.urgencyIntensity(24)).toEqual(1)
    })

    it('should fade the urgency factor down to zero for long shelf life', () => {
      const mid = sut.urgencyIntensity(96)

      expect(mid).toBeGreaterThan(0)
      expect(mid).toBeLessThan(1)
      expect(sut.urgencyIntensity(168)).toEqual(0)
      expect(sut.urgencyIntensity(500)).toEqual(0)
    })

    it('should always renormalize weights to sum 1', () => {
      for (const hours of [1, 24, 60, 100, 168, 400]) {
        const w = sut.effectiveWeights(hours)

        expect(w.proximity + w.urgency + w.compatibility).toBeCloseTo(1, 10)
      }
    })

    it('should use the configured weights as-is for critical batches', () => {
      const w = sut.effectiveWeights(3)

      expect(w.proximity).toBeCloseTo(DEFAULT_MATCHING_CONFIG.weights.proximity, 10)
      expect(w.urgency).toBeCloseTo(DEFAULT_MATCHING_CONFIG.weights.urgency, 10)
    })
  })
})
