import { DEFAULT_MATCHING_CONFIG } from '../config'
import {
  clamp01,
  distanceKm,
  hoursUntilExpiry,
  meetsStorageRequirement,
  needScore,
  proximityScore,
  travelHours,
} from '../criteria'
import type {
  MatchableBatch,
  MatchableInstitution,
  MatchingConfig,
  MatchingStrategy,
  MatchResult,
} from '../types'

export class MultiCriteriaStrategy implements MatchingStrategy {
  readonly name = 'Multicritério'

  constructor(private config: MatchingConfig = DEFAULT_MATCHING_CONFIG) {}

  rank<I extends MatchableInstitution>(
    batch: MatchableBatch,
    institutions: I[],
    now: Date,
  ): MatchResult<I>[] {
    const hoursLeft = hoursUntilExpiry(batch, now)

    if (hoursLeft <= 0) {
      return []
    }

    const weights = this.effectiveWeights(hoursLeft)

    return institutions
      .filter((institution) => meetsStorageRequirement(batch, institution))
      .map((institution) => {
        const distance = distanceKm(batch, institution)
        const travel = travelHours(distance, this.config)

        return { institution, distance, travel }
      })
      .filter(
        ({ distance, travel }) =>
          distance <= this.config.maxRadiusKm && travel < hoursLeft,
      )
      .map(({ institution, distance, travel }) => {
        const proximity = proximityScore(distance, this.config)
        const urgency = clamp01(1 - travel / hoursLeft)
        const need = needScore(institution.stockDays, this.config)
        const compatibility = this.compatibilityScore(batch, institution)

        const score =
          weights.proximity * proximity +
          weights.urgency * urgency +
          weights.need * need +
          weights.compatibility * compatibility

        return {
          institution,
          score,
          distanceKm: distance,
          travelMinutes: travel * 60,
          criteria: { proximity, urgency, need, compatibility },
        }
      })
      .sort((a, b) => b.score - a.score)
  }

  urgencyIntensity(hoursLeft: number) {
    const { criticalHours, urgencyFadeHours } = this.config

    if (hoursLeft <= criticalHours) {
      return 1
    }

    if (hoursLeft >= urgencyFadeHours) {
      return 0
    }

    return (urgencyFadeHours - hoursLeft) / (urgencyFadeHours - criticalHours)
  }

  effectiveWeights(hoursLeft: number) {
    const { proximity, urgency, need, compatibility } = this.config.weights
    const adjustedUrgency = urgency * this.urgencyIntensity(hoursLeft)
    const total = proximity + adjustedUrgency + need + compatibility

    return {
      proximity: proximity / total,
      urgency: adjustedUrgency / total,
      need: need / total,
      compatibility: compatibility / total,
    }
  }

  private compatibilityScore(
    batch: MatchableBatch,
    institution: MatchableInstitution,
  ) {
    const capacityFit = clamp01(
      institution.availableCapacityKg / batch.quantityKg,
    )

    const acceptsType =
      institution.acceptedFoodTypes.length === 0 ||
      institution.acceptedFoodTypes.includes(batch.foodType)

    return 0.6 * capacityFit + 0.4 * (acceptsType ? 1 : 0)
  }
}
