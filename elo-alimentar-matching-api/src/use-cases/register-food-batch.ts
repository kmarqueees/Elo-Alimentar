import type { FoodBatchesRepository } from '@/repositories/food-batches-repository'
import type { FoodBatch, FoodType, StorageCondition } from '@/matching/types'
import { BatchAlreadyExpiredError } from './errors/batch-already-expired-error'
import { InvalidBatchQuantityError } from './errors/invalid-batch-quantity-error'
import { isValidCoordinates } from '@/utils/is-valid-coordinates'
import { InvalidCoordinatesError } from './errors/invalid-coordinates-error'

interface RegisterFoodBatchUseCaseRequest {
  donorId: string
  foodType: FoodType
  quantityKg: number
  expiresAt: Date
  storageCondition: StorageCondition
  latitude: number
  longitude: number
  now?: Date
}

interface RegisterFoodBatchUseCaseResponse {
  batch: FoodBatch
}

export class RegisterFoodBatchUseCase {
  constructor(private batchesRepository: FoodBatchesRepository) {}

  async execute({
    donorId,
    foodType,
    quantityKg,
    expiresAt,
    storageCondition,
    latitude,
    longitude,
    now = new Date(),
  }: RegisterFoodBatchUseCaseRequest): Promise<RegisterFoodBatchUseCaseResponse> {
    if (!(quantityKg > 0)) {
      throw new InvalidBatchQuantityError()
    }

    if (expiresAt.getTime() <= now.getTime()) {
      throw new BatchAlreadyExpiredError()
    }

    if (!isValidCoordinates(latitude, longitude)) {
      throw new InvalidCoordinatesError()
    }

    const batch = await this.batchesRepository.create({
      donorId,
      foodType,
      quantityKg,
      expiresAt,
      storageCondition,
      latitude,
      longitude,
    })

    return { batch }
  }
}
