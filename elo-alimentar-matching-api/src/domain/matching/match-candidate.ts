import type { Institution } from '../institution/institution'
import type { MatchableInstitution } from './types'

/**
 * Fotografia da instituição no instante `now`, no formato que as estratégias
 * de matching entendem: espaço livre e dias de estoque já calculados.
 */
export function toMatchCandidate(
  institution: Institution,
  now: Date,
  committedKg = 0,
): MatchableInstitution {
  return {
    id: institution.id,
    name: institution.name,
    latitude: institution.latitude,
    longitude: institution.longitude,
    hasRefrigeration: institution.hasRefrigeration,
    acceptedFoodTypes: institution.acceptedFoodTypes,
    availableCapacityKg: Math.max(0, institution.freeStorageKg(now) - committedKg),
    stockDays: institution.stockDays(now),
  }
}
