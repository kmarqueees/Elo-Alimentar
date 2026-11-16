import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryInstitutionsRepository } from '@/repositories/in-memory/in-memory-institutions-repository'
import { ValidateInstitutionUseCase } from './validate-institution'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

let institutionsRepository: InMemoryInstitutionsRepository
let sut: ValidateInstitutionUseCase

describe('Validate Institution Use Case', () => {
  beforeEach(() => {
    institutionsRepository = new InMemoryInstitutionsRepository()
    sut = new ValidateInstitutionUseCase(institutionsRepository)
  })

  it('should validate a pending institution (RN03)', async () => {
    const pending = await institutionsRepository.create({
      name: 'Pendente',
      latitude: -3.1,
      longitude: -60,
      hasRefrigeration: true,
      availableCapacityKg: 50,
      acceptedFoodTypes: [],
      validated: false,
    })

    const { institution } = await sut.execute({ institutionId: pending.id })

    expect(institution.validated).toEqual(true)
    expect(await institutionsRepository.findManyValidated()).toHaveLength(1)
  })

  it('should be idempotent for an already validated institution', async () => {
    const validated = await institutionsRepository.create({
      name: 'Validada',
      latitude: -3.1,
      longitude: -60,
      hasRefrigeration: true,
      availableCapacityKg: 50,
      acceptedFoodTypes: [],
      validated: true,
    })

    const { institution } = await sut.execute({ institutionId: validated.id })

    expect(institution.validated).toEqual(true)
  })

  it('should throw when the institution does not exist', async () => {
    await expect(() =>
      sut.execute({ institutionId: 'missing' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })
})
