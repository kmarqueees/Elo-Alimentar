import type { BatchStatus, FoodBatch } from '@/matching/types'

export type CreateFoodBatchData = Omit<FoodBatch, 'id' | 'createdAt' | 'status'> & {
  id?: string
}

export interface FoodBatchesRepository {
  findById(id: string): Promise<FoodBatch | null>
  findManyAvailable(): Promise<FoodBatch[]>
  findMany(status?: BatchStatus): Promise<FoodBatch[]>
  create(data: CreateFoodBatchData): Promise<FoodBatch>
}
