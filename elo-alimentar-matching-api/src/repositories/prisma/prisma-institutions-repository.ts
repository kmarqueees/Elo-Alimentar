import type { Institution as PrismaInstitution, PrismaClient } from '@prisma/client'
import type { Institution } from '@/matching/types'
import type {
  CreateInstitutionData,
  InstitutionsRepository,
} from '../institutions-repository'

function toDomain(row: PrismaInstitution): Institution {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    hasRefrigeration: row.has_refrigeration,
    availableCapacityKg: row.available_capacity_kg,
    acceptedFoodTypes: row.accepted_food_types,
    validated: row.validated,
  }
}

export class PrismaInstitutionsRepository implements InstitutionsRepository {
  constructor(private client: PrismaClient) {}

  async findById(id: string) {
    const row = await this.client.institution.findUnique({ where: { id } })

    return row ? toDomain(row) : null
  }

  async findMany() {
    const rows = await this.client.institution.findMany({
      orderBy: { created_at: 'asc' },
    })

    return rows.map(toDomain)
  }

  async validate(id: string) {
    const exists = await this.client.institution.findUnique({ where: { id } })

    if (!exists) {
      return null
    }

    const row = await this.client.institution.update({
      where: { id },
      data: { validated: true },
    })

    return toDomain(row)
  }

  async findManyValidated() {
    const rows = await this.client.institution.findMany({
      where: { validated: true },
      orderBy: { created_at: 'asc' },
    })

    return rows.map(toDomain)
  }

  async create(data: CreateInstitutionData) {
    const row = await this.client.institution.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        has_refrigeration: data.hasRefrigeration,
        available_capacity_kg: data.availableCapacityKg,
        accepted_food_types: data.acceptedFoodTypes,
        validated: data.validated,
      },
    })

    return toDomain(row)
  }
}
