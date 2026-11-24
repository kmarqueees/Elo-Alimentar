import {
  hoursUntilExpiry,
  meetsStorageRequirement,
  travelHours,
  distanceKm,
} from '@/domain/matching/criteria'
import type {
  MatchableBatch,
  MatchableInstitution,
  MatchingConfig,
  MatchResult,
} from '@/domain/matching/types'

export interface PickupOutcome {
  collected: boolean
  minutesToPickup: number | null
  attempts: number
  firstChoiceViable: boolean
}

export function isViable(
  batch: MatchableBatch,
  institution: MatchableInstitution,
  config: MatchingConfig,
  now: Date,
) {
  const hoursLeft = hoursUntilExpiry(batch, now)
  const travel = travelHours(distanceKm(batch, institution), config)

  return meetsStorageRequirement(batch, institution) && travel < hoursLeft
}

export function simulatePickup(
  batch: MatchableBatch,
  ranking: MatchResult[],
  config: MatchingConfig,
  now: Date,
  offerTimeoutMinutes = 30,
): PickupOutcome {
  const minutesLeft = hoursUntilExpiry(batch, now) * 60
  const first = ranking[0]
  const firstChoiceViable = first
    ? isViable(batch, first.institution, config, now)
    : false

  let elapsed = 0
  let attempts = 0

  for (const result of ranking) {
    attempts += 1

    if (isViable(batch, result.institution, config, now)) {
      const total = elapsed + result.travelMinutes

      if (total < minutesLeft) {
        return {
          collected: true,
          minutesToPickup: total,
          attempts,
          firstChoiceViable,
        }
      }

      break
    }

    elapsed += offerTimeoutMinutes

    if (elapsed >= minutesLeft) {
      break
    }
  }

  return { collected: false, minutesToPickup: null, attempts, firstChoiceViable }
}
