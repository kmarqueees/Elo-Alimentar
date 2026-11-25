import { expect, describe, it, beforeEach } from 'vitest'
import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import { InMemoryInstitutionsRepository } from '@/infra/database/in-memory/in-memory-institutions-repository'
import { makeInstitution } from '@/test/factories/make-institution'
import { ValidateInstitutionUseCase } from './validate-institution'

let institutionsRepository: InMemoryInstitutionsRepository
let sut: ValidateInstitutionUseCase

describe('Validate Institution Use Case', () => {
  beforeEach(() => {
    institutionsRepository = new InMemoryInstitutionsRepository()
    sut = new ValidateInstitutionUseCase(institutionsRepository)
  })

  it('should validate a pending institution (RN03)', async () => {
    const pending = makeInstitution({
      name: 'Pendente',
      latitude: -3.1,
      longitude: -60,
      hasRefrigeration: true,
      storageCapacityKg: 50,
      acceptedFoodTypes: [],
      validated: false,
    })
    await institutionsRepository.create(pending)

    const { institution } = await sut.execute({ institutionId: pending.id })

    expect(institution.validated).toEqual(true)
    expect(await institutionsRepository.findManyValidated()).toHaveLength(1)
  })

  it('should be idempotent for an already validated institution', async () => {
    const validated = makeInstitution({
      name: 'Validada',
      latitude: -3.1,
      longitude: -60,
      hasRefrigeration: true,
      storageCapacityKg: 50,
      acceptedFoodTypes: [],
      validated: true,
    })
    await institutionsRepository.create(validated)

    const { institution } = await sut.execute({ institutionId: validated.id })

    expect(institution.validated).toEqual(true)
  })

  it('should throw when the institution does not exist', async () => {
    await expect(() =>
      sut.execute({ institutionId: 'missing' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })
})
