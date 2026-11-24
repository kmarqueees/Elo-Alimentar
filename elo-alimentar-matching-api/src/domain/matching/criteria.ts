import { Coordinates } from '../shared/coordinates'
import type { MatchableBatch, MatchableInstitution, MatchingConfig } from './types'

const MS_PER_HOUR = 1000 * 60 * 60

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function hoursUntilExpiry(batch: Pick<MatchableBatch, 'expiresAt'>, now: Date) {
  return (batch.expiresAt.getTime() - now.getTime()) / MS_PER_HOUR
}

export function distanceKm(batch: MatchableBatch, institution: MatchableInstitution) {
  return Coordinates.distanceKm(batch, institution)
}

export function travelHours(distance: number, config: MatchingConfig) {
  return distance / config.averageSpeedKmh
}

/** RN01: lote refrigerado ou congelado só vai para quem tem refrigeração. */
export function meetsStorageRequirement(
  batch: MatchableBatch,
  institution: MatchableInstitution,
) {
  if (batch.storageCondition === 'DRY') {
    return true
  }

  return institution.hasRefrigeration
}

export function proximityScore(distance: number, config: MatchingConfig) {
  return clamp01(1 - distance / config.maxRadiusKm)
}
