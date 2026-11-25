import { describe, expect, it } from 'vitest'
import { Address, normalizePostalCode } from './address'
import { InvalidAddressError } from './errors/invalid-address-error'
import { InvalidPostalCodeError } from './errors/invalid-postal-code-error'

const input = {
  street: 'Av. Eduardo Ribeiro',
  number: '520',
  complement: 'sala 3',
  district: 'Centro',
  city: 'Manaus',
  state: 'am',
  postalCode: '69005-040',
}

describe('Address (value object)', () => {
  it('normaliza UF, CEP e espaços, e formata para exibição', () => {
    const address = Address.create({ ...input, street: '  Av.  Eduardo   Ribeiro ' })

    expect(address.street).toBe('Av. Eduardo Ribeiro')
    expect(address.state).toBe('AM')
    expect(address.postalCode).toBe('69005040')
    expect(address.formattedPostalCode).toBe('69005-040')
    expect(address.format()).toBe('Av. Eduardo Ribeiro, 520, sala 3 - Centro, Manaus/AM, 69005-040')
  })

  it('complemento, bairro e CEP são opcionais', () => {
    const address = Address.create({ street: 'Rua A', number: 's/n', city: 'Manaus', state: 'AM' })

    expect(address.format()).toBe('Rua A, s/n, Manaus/AM')
    expect(address.postalCode).toBeNull()
  })

  it('exige rua, número, cidade e uma UF válida', () => {
    expect(() => Address.create({ ...input, street: ' ' })).toThrow(InvalidAddressError)
    expect(() => Address.create({ ...input, number: '' })).toThrow(InvalidAddressError)
    expect(() => Address.create({ ...input, city: '' })).toThrow(InvalidAddressError)
    expect(() => Address.create({ ...input, state: 'XX' })).toThrow(InvalidAddressError)
  })

  it('rejeita CEP que não tem 8 dígitos', () => {
    expect(() => Address.create({ ...input, postalCode: '6900-040' })).toThrow(InvalidPostalCodeError)
    expect(normalizePostalCode(' 69.005-040 ')).toBe('69005040')
  })

  it('é imutável', () => {
    expect(Object.isFrozen(Address.create(input))).toBe(true)
  })
})
