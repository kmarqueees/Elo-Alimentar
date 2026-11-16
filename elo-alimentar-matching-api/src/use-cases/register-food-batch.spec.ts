import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryFoodBatchesRepository } from '@/repositories/in-memory/in-memory-food-batches-repository'
import { RegisterFoodBatchUseCase } from './register-food-batch'
import { BatchAlreadyExpiredError } from './errors/batch-already-expired-error'
import { InvalidBatchQuantityError } from './errors/invalid-batch-quantity-error'
import { InvalidCoordinatesError } from './errors/invalid-coordinates-error'

let batchesRepository: InMemoryFoodBatchesRepository
let sut: RegisterFoodBatchUseCase

const now = new Date('2026-10-16T12:00:00Z')

const validRequest = {
  donorId: 'donor-01',
  foodType: 'HORTIFRUTI' as const,
  quantityKg: 18,
  expiresAt: new Date('2026-10-16T18:00:00Z'),
  storageCondition: 'REFRIGERATED' as const,
  latitude: -3.1019,
  longitude: -60.025,
  now,
}

describe('Register Food Batch Use Case', () => {
  beforeEach(() => {
    batchesRepository = new InMemoryFoodBatchesRepository()
    sut = new RegisterFoodBatchUseCase(batchesRepository)
  })

  it('should be able to register a batch as available', async () => {
    const { batch } = await sut.execute(validRequest)

    expect(batch.id).toEqual(expect.any(String))
    expect(batch.status).toEqual('AVAILABLE')
    expect(batchesRepository.items).toHaveLength(1)
  })

  it('should not register a batch that is already expired', async () => {
    await expect(() =>
      sut.execute({ ...validRequest, expiresAt: new Date('2026-10-16T11:00:00Z') }),
    ).rejects.toBeInstanceOf(BatchAlreadyExpiredError)
  })

  it('should not register a batch with zero or negative quantity', async () => {
    await expect(() =>
      sut.execute({ ...validRequest, quantityKg: 0 }),
    ).rejects.toBeInstanceOf(InvalidBatchQuantityError)

    await expect(() =>
      sut.execute({ ...validRequest, quantityKg: -5 }),
    ).rejects.toBeInstanceOf(InvalidBatchQuantityError)
  })

  it('should not register a batch with invalid coordinates', async () => {
    await expect(() =>
      sut.execute({ ...validRequest, latitude: 120 }),
    ).rejects.toBeInstanceOf(InvalidCoordinatesError)
  })
})
