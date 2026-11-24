import { describe, expect, it } from 'vitest'
import { InvalidCoordinatesError } from '../shared/errors/invalid-coordinates-error'
import { InvalidCapacityError } from './errors/invalid-capacity-error'
import { Institution, type RegisterInstitutionInput } from './institution'

const input: RegisterInstitutionInput = {
  name: 'Cozinha Comunitária',
  latitude: -3.11,
  longitude: -60.02,
  hasRefrigeration: true,
  availableCapacityKg: 80,
}

describe('Institution (agregado)', () => {
  it('nasce não validada e sem restrição de tipo de alimento (RN03)', () => {
    const institution = Institution.register(input)

    expect(institution.validated).toBe(false)
    expect(institution.acceptedFoodTypes).toEqual([])
  })

  it('valida capacidade antes das coordenadas', () => {
    expect(() =>
      Institution.register({ ...input, availableCapacityKg: 0, latitude: 999 }),
    ).toThrow(InvalidCapacityError)
    expect(() => Institution.register({ ...input, longitude: 181 })).toThrow(
      InvalidCoordinatesError,
    )
  })

  it('validate() é idempotente', () => {
    const institution = Institution.register(input)

    institution.validate()
    institution.validate()

    expect(institution.validated).toBe(true)
  })
})
