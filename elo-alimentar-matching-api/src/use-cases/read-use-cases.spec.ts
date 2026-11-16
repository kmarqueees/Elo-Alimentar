import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryFoodBatchesRepository } from '@/repositories/in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '@/repositories/in-memory/in-memory-institutions-repository'
import { GetBatchUseCase } from './get-batch'
import { ListBatchesUseCase } from './list-batches'
import { ListInstitutionsUseCase } from './list-institutions'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

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
    const created = await batchesRepository.create(batchData)

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
    await batchesRepository.create(batchData)
    const reserved = await batchesRepository.create(batchData)
    reserved.status = 'RESERVED'

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
    await institutionsRepository.create({ ...base, name: 'A', validated: true })
    await institutionsRepository.create({ ...base, name: 'B', validated: false })

    const { institutions } = await new ListInstitutionsUseCase(
      institutionsRepository,
    ).execute()

    expect(institutions).toHaveLength(2)
  })
})
