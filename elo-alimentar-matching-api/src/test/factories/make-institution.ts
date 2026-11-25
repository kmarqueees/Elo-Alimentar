import { Institution } from '@/domain/institution/institution'
import { Coordinates } from '@/domain/shared/coordinates'
import type { FoodType } from '@/domain/shared/food'

export interface MakeInstitutionOverrides {
  id?: string
  name?: string
  latitude?: number
  longitude?: number
  hasRefrigeration?: boolean
  storageCapacityKg?: number
  peopleServed?: number
  stockKg?: number
  stockUpdatedAt?: Date
  acceptedFoodTypes?: FoodType[]
  validated?: boolean
}

/**
 * Instituição pronta para testes. Por padrão o consumo é desconhecido
 * (peopleServed = 0 → necessidade neutra) e o estoque está vazio, para que
 * cada teste ligue só o critério que quer exercitar.
 */
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
      storageCapacityKg: 100,
      peopleServed: 0,
      stockKg: 0,
      stockUpdatedAt: new Date('2026-10-16T12:00:00Z'),
      acceptedFoodTypes: [],
      validated: true,
      ...overrides,
      coordinates: Coordinates.create(latitude, longitude),
    },
    institutionId,
  )
}
