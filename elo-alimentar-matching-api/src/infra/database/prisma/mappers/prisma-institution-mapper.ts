import type { Prisma, Institution as PrismaInstitution } from '@prisma/client'
import { Institution } from '@/domain/institution/institution'
import { Coordinates } from '@/domain/shared/coordinates'

export class PrismaInstitutionMapper {
  static toDomain(row: PrismaInstitution) {
    return Institution.restore(
      {
        name: row.name,
        coordinates: Coordinates.create(row.latitude, row.longitude),
        hasRefrigeration: row.has_refrigeration,
        availableCapacityKg: row.available_capacity_kg,
        acceptedFoodTypes: row.accepted_food_types,
        validated: row.validated,
      },
      row.id,
    )
  }

  static toPersistence(institution: Institution): Prisma.InstitutionUncheckedCreateInput {
    return {
      id: institution.id,
      name: institution.name,
      latitude: institution.latitude,
      longitude: institution.longitude,
      has_refrigeration: institution.hasRefrigeration,
      available_capacity_kg: institution.availableCapacityKg,
      accepted_food_types: [...institution.acceptedFoodTypes],
      validated: institution.validated,
    }
  }
}
