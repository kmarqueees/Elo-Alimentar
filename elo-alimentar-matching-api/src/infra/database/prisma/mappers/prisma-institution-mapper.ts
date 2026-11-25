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
        storageCapacityKg: row.storage_capacity_kg,
        peopleServed: row.people_served,
        stockKg: row.stock_kg,
        stockUpdatedAt: row.stock_updated_at,
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
      storage_capacity_kg: institution.storageCapacityKg,
      people_served: institution.peopleServed,
      stock_kg: institution.stockKg,
      stock_updated_at: institution.stockUpdatedAt,
      accepted_food_types: [...institution.acceptedFoodTypes],
      validated: institution.validated,
    }
  }
}
