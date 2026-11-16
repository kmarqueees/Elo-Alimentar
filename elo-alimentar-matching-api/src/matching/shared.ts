import { getDistanceBetweenCoordinates } from '@/utils/get-distance-between-coordinates'
import type { FoodBatch, Institution, MatchingConfig } from './types'

const MS_PER_HOUR = 1000 * 60 * 60

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function hoursUntilExpiry(batch: FoodBatch, now: Date) {
  return (batch.expiresAt.getTime() - now.getTime()) / MS_PER_HOUR
}

export function distanceKm(batch: FoodBatch, institution: Institution) {
  return getDistanceBetweenCoordinates(
    { latitude: batch.latitude, longitude: batch.longitude },
    { latitude: institution.latitude, longitude: institution.longitude },
  )
}

export function travelHours(distance: number, config: MatchingConfig) {
  return distance / config.averageSpeedKmh
}

export function meetsStorageRequirement(
  batch: FoodBatch,
  institution: Institution,
) {
  if (batch.storageCondition === 'DRY') {
    return true
  }

  return institution.hasRefrigeration
}

export function proximityScore(distance: number, config: MatchingConfig) {
  return clamp01(1 - distance / config.maxRadiusKm)
}
