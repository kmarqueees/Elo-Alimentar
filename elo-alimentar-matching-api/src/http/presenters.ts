import type {
  CompareStrategiesUseCaseResponse,
  StrategySummary,
} from '@/use-cases/compare-strategies'
import { hoursUntilExpiry } from '@/matching/shared'
import type { FoodBatch, Institution, MatchResult } from '@/matching/types'

function round(value: number, digits: number) {
  const factor = 10 ** digits

  return Math.round(value * factor) / factor
}

export function presentInstitution(institution: Institution) {
  return {
    id: institution.id,
    name: institution.name,
    latitude: institution.latitude,
    longitude: institution.longitude,
    hasRefrigeration: institution.hasRefrigeration,
    availableCapacityKg: institution.availableCapacityKg,
    acceptedFoodTypes: institution.acceptedFoodTypes,
    validated: institution.validated,
  }
}

export function presentRanking(ranking: MatchResult[]) {
  return ranking.map((result, index) => ({
    position: index + 1,
    institution: {
      id: result.institution.id,
      name: result.institution.name,
    },
    score: round(result.score, 3),
    distanceKm: round(result.distanceKm, 2),
    travelMinutes: round(result.travelMinutes, 1),
    criteria: {
      proximity: round(result.criteria.proximity, 3),
      urgency: round(result.criteria.urgency, 3),
      compatibility: round(result.criteria.compatibility, 3),
    },
  }))
}

export function presentSummary(summary: StrategySummary) {
  return {
    strategy: summary.strategy,
    collectedBatches: summary.collectedBatches,
    totalBatches: summary.totalBatches,
    collectionRatePercent: round(summary.collectionRate * 100, 1),
    firstChoiceViablePercent: round(summary.firstChoiceViableRate * 100, 1),
    averageAttempts:
      summary.averageAttempts === null ? null : round(summary.averageAttempts, 2),
    averageMinutesToPickup:
      summary.averageMinutesToPickup === null
        ? null
        : round(summary.averageMinutesToPickup, 1),
  }
}

export function presentMatches({
  strategy,
  now,
  batch,
  ranking,
}: {
  strategy: string
  now: Date
  batch: FoodBatch
  ranking: MatchResult[]
}) {
  return {
    strategy,
    now: now.toISOString(),
    hoursUntilExpiry: round(hoursUntilExpiry(batch, now), 2),
    batch,
    ranking: presentRanking(ranking),
  }
}

export function presentComparison(
  result: CompareStrategiesUseCaseResponse,
  now: Date,
) {
  return {
    now: now.toISOString(),
    baseline: 'Somente distância',
    strategies: result.summaries.map(presentSummary),
    timeReductionPercent:
      result.timeReductionPercent === null
        ? null
        : round(result.timeReductionPercent, 1),
    commonCollectedBatches: result.commonCollectedBatches,
    note: 'Tempo até a retirada é modelado: cada instituição inviável consome 30 min de timeout (RN04) antes de o lote passar para a próxima.',
  }
}
