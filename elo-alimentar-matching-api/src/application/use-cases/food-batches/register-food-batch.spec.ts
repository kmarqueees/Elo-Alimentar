import { expect, describe, it, beforeEach } from 'vitest'
import { DomainEventPublisher } from '@/core/events/domain-event-publisher'
import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import { BatchAlreadyExpiredError } from '@/domain/food-batch/errors/batch-already-expired-error'
import { InvalidBatchQuantityError } from '@/domain/food-batch/errors/invalid-batch-quantity-error'
import { InvalidCoordinatesError } from '@/domain/shared/errors/invalid-coordinates-error'
import { InMemoryDonorsRepository } from '@/infra/database/in-memory/in-memory-donors-repository'
import { EligibleInstitutionsRanker } from '@/domain/matching/eligible-institutions-ranker'
import { SequentialOfferService } from '@/domain/matching/sequential-offer-service'
import { MultiCriteriaStrategy } from '@/domain/matching/strategies/multi-criteria-strategy'
import { InMemoryFoodBatchesRepository } from '@/infra/database/in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '@/infra/database/in-memory/in-memory-institutions-repository'
import { makeInstitution } from '@/test/factories/make-institution'
import { RegisterFoodBatchUseCase } from './register-food-batch'

let batchesRepository: InMemoryFoodBatchesRepository
let institutionsRepository: InMemoryInstitutionsRepository
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
    institutionsRepository = new InMemoryInstitutionsRepository()
    sut = new RegisterFoodBatchUseCase(
      batchesRepository,
      new InMemoryDonorsRepository(['donor-01']),
      institutionsRepository,
      new SequentialOfferService(
        new EligibleInstitutionsRanker(new MultiCriteriaStrategy()),
        30,
      ),
      new DomainEventPublisher(),
    )
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

  it('should not register a batch for an unknown donor', async () => {
    await expect(() =>
      sut.execute({ ...validRequest, donorId: 'unknown-donor' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)

    expect(batchesRepository.items).toHaveLength(0)
  })

  it('should offer the batch right away to the best ranked institution', async () => {
    const institution = makeInstitution({ latitude: -3.1, longitude: -60.02 })
    await institutionsRepository.create(institution)

    const { batch } = await sut.execute(validRequest)

    expect(batch.status).toEqual('OFFERED')
    expect(batch.activeOffer?.institutionId).toEqual(institution.id)
  })
})
