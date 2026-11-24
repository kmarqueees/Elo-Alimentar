import type { GeoPoint } from '../shared/coordinates'
import type { FoodType, StorageCondition } from '../shared/food'

/**
 * O que o matching precisa saber de um lote. As entidades FoodBatch e
 * Institution satisfazem estes contratos; o algoritmo não depende delas
 * diretamente e pode ser testado com objetos simples.
 */
export interface MatchableBatch extends GeoPoint {
  foodType: FoodType
  quantityKg: number
  expiresAt: Date
  storageCondition: StorageCondition
}

export interface MatchableInstitution extends GeoPoint {
  id: string
  name: string
  hasRefrigeration: boolean
  availableCapacityKg: number
  acceptedFoodTypes: readonly FoodType[]
}

export interface MatchingConfig {
  weights: {
    proximity: number
    urgency: number
    compatibility: number
  }
  averageSpeedKmh: number
  maxRadiusKm: number
  criticalHours: number
  urgencyFadeHours: number
}

export interface CriteriaBreakdown {
  proximity: number
  urgency: number
  compatibility: number
}

export interface MatchResult<I extends MatchableInstitution = MatchableInstitution> {
  institution: I
  score: number
  distanceKm: number
  travelMinutes: number
  criteria: CriteriaBreakdown
}

/** Domain service: ordena instituições para um lote. Puro, sem I/O. */
export interface MatchingStrategy {
  readonly name: string
  rank<I extends MatchableInstitution>(
    batch: MatchableBatch,
    institutions: I[],
    now: Date,
  ): MatchResult<I>[]
}
