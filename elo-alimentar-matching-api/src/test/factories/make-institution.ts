import { Institution } from '@/domain/institution/institution'
import { Coordinates } from '@/domain/shared/coordinates'
import type { FoodType } from '@/domain/shared/food'

export interface MakeInstitutionOverrides {
  id?: string
  name?: string
  latitude?: number
  longitude?: number
  hasRefrigeration?: boolean
  availableCapacityKg?: number
  acceptedFoodTypes?: FoodType[]
  validated?: boolean
}

export function makeInstitution({
  id,
  latitude = -3.1,
  longitude = -60.0,
  ...overrides
}: MakeInstitutionOverrides = {}) {
  const institutionId = id ?? crypto.randomUUID()

  return Institution.restore(
    {
      name: institutionId,
      hasRefrigeration: true,
      availableCapacityKg: 100,
      acceptedFoodTypes: [],
      validated: true,
      ...overrides,
      coordinates: Coordinates.create(latitude, longitude),
    },
    institutionId,
  )
}
