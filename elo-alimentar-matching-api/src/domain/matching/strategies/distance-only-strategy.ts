import { DEFAULT_MATCHING_CONFIG } from '../config'
import {
  distanceKm,
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

export class DistanceOnlyStrategy implements MatchingStrategy {
  readonly name = 'Somente distância'

  constructor(private config: MatchingConfig = DEFAULT_MATCHING_CONFIG) {}

  rank<I extends MatchableInstitution>(
    batch: MatchableBatch,
    institutions: I[],
  ): MatchResult<I>[] {
    return institutions
      .map((institution) => {
        const distance = distanceKm(batch, institution)
        const proximity = proximityScore(distance, this.config)

        return {
          institution,
          score: proximity,
          distanceKm: distance,
          travelMinutes: travelHours(distance, this.config) * 60,
          criteria: { proximity, urgency: 0, compatibility: 0 },
        }
      })
      .filter((result) => result.distanceKm <= this.config.maxRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }
}
