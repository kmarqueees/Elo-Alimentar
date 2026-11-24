import { beforeEach, describe, expect, it } from 'vitest'
import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import { InMemoryFoodBatchesRepository } from '@/infra/database/in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '@/infra/database/in-memory/in-memory-institutions-repository'
import { makeFoodBatch } from '@/test/factories/make-food-batch'
import { makeInstitution } from '@/test/factories/make-institution'
import { GetBatchUseCase } from './food-batches/get-batch'
import { ListBatchesUseCase } from './food-batches/list-batches'
import { ListInstitutionsUseCase } from './institutions/list-institutions'

let batchesRepository: InMemoryFoodBatchesRepository
let institutionsRepository: InMemoryInstitutionsRepository

const batchData = {
  donorId: 'donor-1',
  foodType: 'HORTIFRUTI' as const,
  quantityKg: 10,
  expiresAt: new Date('2026-10-17T12:00:00Z'),
  storageCondition: 'DRY' as const,
  latitude: -3.119,
  longitude: -60.0217,
}

describe('casos de uso de consulta', () => {
  beforeEach(() => {
    batchesRepository = new InMemoryFoodBatchesRepository()
    institutionsRepository = new InMemoryInstitutionsRepository()
  })

  it('GetBatch devolve o lote existente', async () => {
    const created = makeFoodBatch(batchData)
    await batchesRepository.create(created)

    const { batch } = await new GetBatchUseCase(batchesRepository).execute({
      batchId: created.id,
    })

    expect(batch.id).toBe(created.id)
  })

  it('GetBatch lança ResourceNotFoundError para lote inexistente', async () => {
    await expect(
      new GetBatchUseCase(batchesRepository).execute({ batchId: 'nope' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  it('ListBatches lista todos e filtra por status', async () => {
    await batchesRepository.create(makeFoodBatch(batchData))
    await batchesRepository.create(makeFoodBatch({ ...batchData, status: 'RESERVED' }))

    const sut = new ListBatchesUseCase(batchesRepository)

    expect((await sut.execute()).batches).toHaveLength(2)
    expect((await sut.execute({ status: 'AVAILABLE' })).batches).toHaveLength(1)
    expect((await sut.execute({ status: 'RESERVED' })).batches).toHaveLength(1)
  })

  it('ListInstitutions lista validadas e não validadas', async () => {
    const base = {
      latitude: -3.1,
      longitude: -60,
      hasRefrigeration: false,
      availableCapacityKg: 50,
      acceptedFoodTypes: [],
    }
    await institutionsRepository.create(makeInstitution({ ...base, name: 'A', validated: true }))
    await institutionsRepository.create(makeInstitution({ ...base, name: 'B', validated: false }))

    const { institutions } = await new ListInstitutionsUseCase(
      institutionsRepository,
    ).execute()

    expect(institutions).toHaveLength(2)
  })
})
