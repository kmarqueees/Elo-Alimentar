import { describe, expect, it } from 'vitest'
import { InvalidCoordinatesError } from '../shared/errors/invalid-coordinates-error'
import { InvalidCapacityError } from './errors/invalid-capacity-error'
import { InvalidPeopleServedError } from './errors/invalid-people-served-error'
import { InvalidStockError } from './errors/invalid-stock-error'
import { Institution, type RegisterInstitutionInput } from './institution'

const now = new Date('2026-10-16T12:00:00Z')
const daysLater = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000)

/** 80 pessoas × 0,5 kg = 40 kg/dia; 120 kg dão 3 dias. */
const input: RegisterInstitutionInput = {
  name: 'ONG Mesa Solidária',
  latitude: -3.11,
  longitude: -60.02,
  hasRefrigeration: true,
  storageCapacityKg: 300,
  peopleServed: 80,
  stockKg: 120,
}

describe('Institution (agregado)', () => {
  describe('cadastro', () => {
    it('nasce não validada e sem restrição de tipo de alimento (RN03)', () => {
      const institution = Institution.register(input, now)

      expect(institution.validated).toBe(false)
      expect(institution.acceptedFoodTypes).toEqual([])
      expect(institution.stockUpdatedAt).toEqual(now)
    })

    it('valida capacidade, pessoas atendidas, estoque e coordenadas', () => {
      expect(() => Institution.register({ ...input, storageCapacityKg: 0 }, now)).toThrow(InvalidCapacityError)
      expect(() => Institution.register({ ...input, peopleServed: 0 }, now)).toThrow(InvalidPeopleServedError)
      expect(() => Institution.register({ ...input, peopleServed: 2.5 }, now)).toThrow(InvalidPeopleServedError)
      expect(() => Institution.register({ ...input, stockKg: -1 }, now)).toThrow(InvalidStockError)
      expect(() => Institution.register({ ...input, longitude: 181 }, now)).toThrow(InvalidCoordinatesError)
    })

    it('estoque é opcional e começa em zero', () => {
      const { stockKg: _omit, ...withoutStock } = input
      const institution = Institution.register(withoutStock, now)

      expect(institution.estimatedStockKg(now)).toBe(0)
    })

    it('validate() é idempotente', () => {
      const institution = Institution.register(input, now)

      institution.validate()
      institution.validate()

      expect(institution.validated).toBe(true)
    })
  })

  describe('estoque estimado', () => {
    it('desconta o consumo diário com o passar do tempo', () => {
      const institution = Institution.register(input, now)

      expect(institution.dailyConsumptionKg()).toBe(40)
      expect(institution.stockDays(now)).toBe(3)
      expect(institution.estimatedStockKg(daysLater(1))).toBeCloseTo(80, 6)
      expect(institution.stockDays(daysLater(2))).toBeCloseTo(1, 6)
    })

    it('nunca fica negativo', () => {
      const institution = Institution.register(input, now)

      expect(institution.estimatedStockKg(daysLater(10))).toBe(0)
      expect(institution.stockDays(daysLater(10))).toBe(0)
    })

    it('soma a doação retirada ao estoque estimado naquele momento', () => {
      const institution = Institution.register(input, now)

      institution.receiveDonation(30, daysLater(2))

      expect(institution.estimatedStockKg(daysLater(2))).toBeCloseTo(70, 6)
      expect(institution.stockUpdatedAt).toEqual(daysLater(2))
    })

    it('o estoque informado pela instituição sempre prevalece sobre a estimativa', () => {
      const institution = Institution.register(input, now)

      institution.updateStock(50, daysLater(3))

      expect(institution.estimatedStockKg(daysLater(3))).toBe(50)
      expect(() => institution.updateStock(-5, daysLater(3))).toThrow(InvalidStockError)
    })

    it('espaço livre = capacidade − estoque estimado', () => {
      const institution = Institution.register(input, now)

      expect(institution.freeStorageKg(now)).toBe(180)
      expect(institution.freeStorageKg(daysLater(1))).toBeCloseTo(220, 6)
    })
  })
})
