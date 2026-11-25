import { expect, describe, it, beforeEach } from 'vitest'
import { InvalidCapacityError } from '@/domain/institution/errors/invalid-capacity-error'
import { InvalidCoordinatesError } from '@/domain/shared/errors/invalid-coordinates-error'
import { InMemoryInstitutionsRepository } from '@/infra/database/in-memory/in-memory-institutions-repository'
import { RegisterInstitutionUseCase } from './register-institution'

let institutionsRepository: InMemoryInstitutionsRepository
let sut: RegisterInstitutionUseCase

const validRequest = {
  name: 'Cozinha Comunitária Esperança',
  latitude: -3.11,
  longitude: -60.0217,
  hasRefrigeration: true,
  storageCapacityKg: 80,
  peopleServed: 60,
  now: new Date('2026-10-16T12:00:00Z'),
}

describe('Register Institution Use Case', () => {
  beforeEach(() => {
    institutionsRepository = new InMemoryInstitutionsRepository()
    sut = new RegisterInstitutionUseCase(institutionsRepository)
  })

  it('should register an institution as NOT validated (RN03)', async () => {
    const { institution } = await sut.execute(validRequest)

    expect(institution.id).toEqual(expect.any(String))
    expect(institution.validated).toEqual(false)
    expect(institution.acceptedFoodTypes).toEqual([])
  })

  it('should keep the accepted food types', async () => {
    const { institution } = await sut.execute({
      ...validRequest,
      acceptedFoodTypes: ['HORTIFRUTI'],
    })

    expect(institution.acceptedFoodTypes).toEqual(['HORTIFRUTI'])
  })

  it('should reject zero or negative capacity', async () => {
    await expect(() =>
      sut.execute({ ...validRequest, storageCapacityKg: 0 }),
    ).rejects.toBeInstanceOf(InvalidCapacityError)
  })

  it('should reject invalid coordinates', async () => {
    await expect(() =>
      sut.execute({ ...validRequest, longitude: 200 }),
    ).rejects.toBeInstanceOf(InvalidCoordinatesError)
  })
})
