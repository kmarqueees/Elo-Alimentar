import type { FoodBatch as PrismaFoodBatch, PrismaClient } from '@prisma/client'
import type { BatchStatus, FoodBatch } from '@/matching/types'
import { ResourceNotFoundError } from '@/use-cases/errors/resource-not-found-error'
import type {
  CreateFoodBatchData,
  FoodBatchesRepository,
} from '../food-batches-repository'

function toDomain(row: PrismaFoodBatch): FoodBatch {
  return {
    id: row.id,
    donorId: row.donor_id,
    foodType: row.food_type,
    quantityKg: row.quantity_kg,
    expiresAt: row.expires_at,
    storageCondition: row.storage_condition,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    createdAt: row.created_at,
  }
}

export class PrismaFoodBatchesRepository implements FoodBatchesRepository {
  constructor(private client: PrismaClient) {}

  async findById(id: string) {
    const row = await this.client.foodBatch.findUnique({ where: { id } })

    return row ? toDomain(row) : null
  }

  async findManyAvailable() {
    const rows = await this.client.foodBatch.findMany({
      where: { status: 'AVAILABLE' },
      orderBy: { created_at: 'asc' },
    })

    return rows.map(toDomain)
  }

  async findMany(status?: BatchStatus) {
    const rows = await this.client.foodBatch.findMany({
      where: status ? { status } : undefined,
      orderBy: { created_at: 'asc' },
    })

    return rows.map(toDomain)
  }

  async create(data: CreateFoodBatchData) {
    const donor = await this.client.user.findUnique({
      where: { id: data.donorId },
    })

    if (!donor) {
      throw new ResourceNotFoundError()
    }

    const row = await this.client.foodBatch.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        donor_id: data.donorId,
        food_type: data.foodType,
        quantity_kg: data.quantityKg,
        expires_at: data.expiresAt,
        storage_condition: data.storageCondition,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    })

    return toDomain(row)
  }
}
