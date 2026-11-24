import type { FoodBatch } from '@/domain/food-batch/food-batch'

/** Contrato HTTP do lote: mesmos campos consumidos pelo front end. */
export function presentFoodBatch(batch: FoodBatch) {
  return {
    id: batch.id,
    donorId: batch.donorId,
    foodType: batch.foodType,
    quantityKg: batch.quantityKg,
    expiresAt: batch.expiresAt,
    storageCondition: batch.storageCondition,
    latitude: batch.latitude,
    longitude: batch.longitude,
    status: batch.status,
    createdAt: batch.createdAt,
  }
}
