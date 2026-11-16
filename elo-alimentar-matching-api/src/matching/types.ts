export const STORAGE_CONDITIONS = ['REFRIGERATED', 'FROZEN', 'DRY'] as const
export type StorageCondition = (typeof STORAGE_CONDITIONS)[number]

export const FOOD_TYPES = [
  'HORTIFRUTI',
  'PANIFICADOS',
  'PRATOS_PRONTOS',
  'LATICINIOS',
  'CARNES',
  'NAO_PERECIVEIS',
] as const
export type FoodType = (typeof FOOD_TYPES)[number]

export type BatchStatus = 'AVAILABLE' | 'RESERVED' | 'COLLECTED' | 'EXPIRED'

export interface FoodBatch {
  id: string
  donorId: string
  foodType: FoodType
  quantityKg: number
  expiresAt: Date
  storageCondition: StorageCondition
  latitude: number
  longitude: number
  status: BatchStatus
  createdAt: Date
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED'

export interface Reservation {
  id: string
  batchId: string
  institutionId: string
  score: number
  status: ReservationStatus
  createdAt: Date
  expiresAt: Date
  confirmedAt: Date | null
}

export interface Institution {
  id: string
  name: string
  latitude: number
  longitude: number
  hasRefrigeration: boolean
  availableCapacityKg: number
  acceptedFoodTypes: FoodType[]
  validated: boolean
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

export interface MatchResult {
  institution: Institution
  score: number
  distanceKm: number
  travelMinutes: number
  criteria: CriteriaBreakdown
}

export interface MatchingStrategy {
  readonly name: string
  rank(
    batch: FoodBatch,
    institutions: Institution[],
    now: Date,
  ): MatchResult[]
}
