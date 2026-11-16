import { randomUUID } from 'node:crypto'
import type { BatchStatus, FoodBatch } from '@/matching/types'
import type {
  CreateFoodBatchData,
  FoodBatchesRepository,
} from '../food-batches-repository'

export class InMemoryFoodBatchesRepository implements FoodBatchesRepository {
  public items: FoodBatch[] = []

  async findById(id: string) {
    return this.items.find((item) => item.id === id) ?? null
  }

  async findManyAvailable() {
    return this.items.filter((item) => item.status === 'AVAILABLE')
  }

  async findMany(status?: BatchStatus) {
    return this.items.filter((item) => !status || item.status === status)
  }

  async create(data: CreateFoodBatchData) {
    const batch: FoodBatch = {
      ...data,
      id: data.id ?? randomUUID(),
      status: 'AVAILABLE',
      createdAt: new Date(),
    }

    this.items.push(batch)

    return batch
  }
}
