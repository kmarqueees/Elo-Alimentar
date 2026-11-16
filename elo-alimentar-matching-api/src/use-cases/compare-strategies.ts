import type { FoodBatchesRepository } from '@/repositories/food-batches-repository'
import type { InstitutionsRepository } from '@/repositories/institutions-repository'
import { DEFAULT_MATCHING_CONFIG } from '@/matching/config'
import { simulatePickup, type PickupOutcome } from '@/matching/evaluation'
import type {
  FoodBatch,
  Institution,
  MatchingConfig,
  MatchingStrategy,
} from '@/matching/types'

interface CompareStrategiesUseCaseRequest {
  now?: Date
}

export interface StrategySummary {
  strategy: string
  totalBatches: number
  collectedBatches: number
  collectionRate: number
  firstChoiceViableRate: number
  averageAttempts: number | null
  averageMinutesToPickup: number | null
}

export interface CompareStrategiesUseCaseResponse {
  perBatch: { batchId: string; outcomes: Record<string, PickupOutcome> }[]
  summaries: StrategySummary[]
  timeReductionPercent: number | null
  commonCollectedBatches: number
}

function average(values: number[]) {
  if (values.length === 0) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

type Outcomes = Record<string, PickupOutcome>

function summarize(
  strategyName: string,
  perBatch: { outcomes: Outcomes }[],
): StrategySummary {
  const outcomes = perBatch.map((item) => item.outcomes[strategyName]!)
  const collected = outcomes.filter((outcome) => outcome.collected)
  const rateOf = (count: number) =>
    outcomes.length === 0 ? 0 : count / outcomes.length

  return {
    strategy: strategyName,
    totalBatches: outcomes.length,
    collectedBatches: collected.length,
    collectionRate: rateOf(collected.length),
    firstChoiceViableRate: rateOf(
      outcomes.filter((outcome) => outcome.firstChoiceViable).length,
    ),
    averageAttempts: average(collected.map((outcome) => outcome.attempts)),
    averageMinutesToPickup: average(
      collected.map((outcome) => outcome.minutesToPickup!),
    ),
  }
}

function compareTimeToPickup(
  perBatch: { outcomes: Outcomes }[],
  baselineName: string,
  challengerName: string,
) {
  const common = perBatch.filter(
    (item) =>
      item.outcomes[baselineName]!.collected &&
      item.outcomes[challengerName]!.collected,
  )

  const baselineAvg = average(
    common.map((item) => item.outcomes[baselineName]!.minutesToPickup!),
  )
  const challengerAvg = average(
    common.map((item) => item.outcomes[challengerName]!.minutesToPickup!),
  )

  const timeReductionPercent =
    baselineAvg !== null && challengerAvg !== null && baselineAvg > 0
      ? ((baselineAvg - challengerAvg) / baselineAvg) * 100
      : null

  return { timeReductionPercent, commonCollectedBatches: common.length }
}

export class CompareStrategiesUseCase {
  constructor(
    private batchesRepository: FoodBatchesRepository,
    private institutionsRepository: InstitutionsRepository,
    private strategies: MatchingStrategy[],
    private config: MatchingConfig = DEFAULT_MATCHING_CONFIG,
    private reservationTimeoutMinutes = 30,
  ) {}

  async execute({
    now = new Date(),
  }: CompareStrategiesUseCaseRequest = {}): Promise<CompareStrategiesUseCaseResponse> {
    const batches = await this.batchesRepository.findManyAvailable()
    const institutions = await this.institutionsRepository.findManyValidated()

    const perBatch = batches.map((batch) => ({
      batchId: batch.id,
      outcomes: this.simulateBatch(batch, institutions, now),
    }))

    const summaries = this.strategies.map((strategy) =>
      summarize(strategy.name, perBatch),
    )

    const [baseline, challenger] = this.strategies

    const comparison =
      baseline && challenger
        ? compareTimeToPickup(perBatch, baseline.name, challenger.name)
        : { timeReductionPercent: null, commonCollectedBatches: 0 }

    return { perBatch, summaries, ...comparison }
  }

  private simulateBatch(batch: FoodBatch, institutions: Institution[], now: Date) {
    const outcomes: Outcomes = {}

    for (const strategy of this.strategies) {
      outcomes[strategy.name] = simulatePickup(
        batch,
        strategy.rank(batch, institutions, now),
        this.config,
        now,
        this.reservationTimeoutMinutes,
      )
    }

    return outcomes
  }
}
