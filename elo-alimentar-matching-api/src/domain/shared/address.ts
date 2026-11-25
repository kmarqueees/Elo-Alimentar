import { InvalidAddressError } from './errors/invalid-address-error'
import { InvalidPostalCodeError } from './errors/invalid-postal-code-error'

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export interface AddressInput {
  street: string
  number: string
  complement?: string | null | undefined
  district?: string | null | undefined
  city: string
  state: string
  postalCode?: string | null | undefined
}

/** Aceita "69005-040", "69005040" ou " 69.005-040 " e devolve só os 8 dígitos. */
export function normalizePostalCode(value: string) {
  const digits = value.replace(/\D/g, '')

  if (digits.length !== 8) {
    throw new InvalidPostalCodeError()
  }

  return digits
}

const clean = (value: string | null | undefined) => {
  const trimmed = value?.trim().replace(/\s+/g, ' ') ?? ''

  return trimmed === '' ? null : trimmed
}

/**
 * Value Object: endereço de retirada. Imutável, sempre completo o bastante
 * para alguém ir até lá (rua, número, cidade e UF).
 */
export class Address {
  private constructor(
    readonly street: string,
    readonly number: string,
    readonly complement: string | null,
    readonly district: string | null,
    readonly city: string,
    readonly state: string,
    readonly postalCode: string | null,
  ) {
    Object.freeze(this)
  }

  static create(input: AddressInput) {
    const street = clean(input.street)
    const number = clean(input.number)
    const city = clean(input.city)
    const state = clean(input.state)?.toUpperCase() ?? null

    if (!street || !number || !city || !state || !(BRAZILIAN_STATES as readonly string[]).includes(state)) {
      throw new InvalidAddressError()
    }

    const postalCode = clean(input.postalCode)

    return new Address(
      street,
      number,
      clean(input.complement),
      clean(input.district),
      city,
      state,
      postalCode ? normalizePostalCode(postalCode) : null,
    )
  }

  /** CEP com máscara: 69005-040. */
  get formattedPostalCode() {
    return this.postalCode ? `${this.postalCode.slice(0, 5)}-${this.postalCode.slice(5)}` : null
  }

  /** "Av. Eduardo Ribeiro, 520, sala 3 - Centro, Manaus/AM, 69005-040" */
  format() {
    const firstLine = [this.street, this.number, this.complement].filter(Boolean).join(', ')
    const parts = [
      this.district ? `${firstLine} - ${this.district}` : firstLine,
      `${this.city}/${this.state}`,
      this.formattedPostalCode,
    ]

    return parts.filter(Boolean).join(', ')
  }

  equals(other: Address) {
    return this.format() === other.format()
  }
}
