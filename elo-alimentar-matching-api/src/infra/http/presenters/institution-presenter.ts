import type { Institution } from '@/domain/institution/institution'

export function presentInstitution(institution: Institution) {
  return {
    id: institution.id,
    name: institution.name,
    latitude: institution.latitude,
    longitude: institution.longitude,
    hasRefrigeration: institution.hasRefrigeration,
    availableCapacityKg: institution.availableCapacityKg,
    acceptedFoodTypes: institution.acceptedFoodTypes,
    validated: institution.validated,
  }
}
