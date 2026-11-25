import type {
  CompareStrategiesUseCaseResponse,
  StrategySummary,
} from '@/application/evaluation/compare-strategies'
import type { FoodBatch } from '@/domain/food-batch/food-batch'
import type { MatchResult } from '@/domain/matching/types'
import { presentFoodBatch } from './food-batch-presenter'

function round(value: number, digits: number) {
  const factor = 10 ** digits

  return Math.round(value * factor) / factor
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
      need: round(result.criteria.need, 3),
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
    hoursUntilExpiry: round(batch.hoursUntilExpiry(now), 2),
    batch: presentFoodBatch(batch),
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
