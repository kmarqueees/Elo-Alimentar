import type { MatchingConfig } from './types'

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  weights: {
    proximity: 0.4,
    urgency: 0.35,
    compatibility: 0.25,
  },
  averageSpeedKmh: 30,
  maxRadiusKm: 15,
  criticalHours: 24,
  urgencyFadeHours: 168,
}
