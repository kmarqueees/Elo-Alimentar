import { DEFAULT_MATCHING_CONFIG } from '../config'
import {
  distanceKm,
  proximityScore,
  travelHours,
} from '../shared'
import type {
  FoodBatch,
  Institution,
  MatchingConfig,
  MatchingStrategy,
  MatchResult,
} from '../types'

export class DistanceOnlyStrategy implements MatchingStrategy {
  readonly name = 'Somente distância'

  constructor(private config: MatchingConfig = DEFAULT_MATCHING_CONFIG) {}

  rank(batch: FoodBatch, institutions: Institution[]): MatchResult[] {
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
