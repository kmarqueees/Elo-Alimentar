import type { MatchingConfig } from './types'

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  weights: {
    proximity: 0.3,
    urgency: 0.3,
    need: 0.25,
    compatibility: 0.15,
  },
  averageSpeedKmh: 30,
  maxRadiusKm: 15,
  criticalHours: 24,
  urgencyFadeHours: 168,
  criticalStockDays: 1,
  comfortableStockDays: 7,
}
