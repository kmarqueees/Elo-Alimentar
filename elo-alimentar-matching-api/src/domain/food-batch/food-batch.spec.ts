import { describe, expect, it } from 'vitest'
import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import { InvalidCoordinatesError } from '../shared/errors/invalid-coordinates-error'
import { BatchAlreadyExpiredError } from './errors/batch-already-expired-error'
import { BatchNotAvailableError } from './errors/batch-not-available-error'
import { InvalidBatchQuantityError } from './errors/invalid-batch-quantity-error'
import { InvalidOfferStateError } from './errors/invalid-offer-state-error'
import { OfferExpiredError } from './errors/offer-expired-error'
import { OfferForAnotherInstitutionError } from './errors/offer-for-another-institution-error'
import { FoodBatch, type RegisterFoodBatchInput } from './food-batch'

const now = new Date('2026-10-16T12:00:00Z')
const minutesLater = (m: number) => new Date(now.getTime() + m * 60_000)

const input: RegisterFoodBatchInput = {
  donorId: 'donor-1',
  foodType: 'HORTIFRUTI',
  quantityKg: 18,
  expiresAt: new Date('2026-10-16T14:00:00Z'),
  storageCondition: 'REFRIGERATED',
  latitude: -3.1,
  longitude: -60,
}

function offeredBatch(institutionId = 'inst-a') {
  const batch = FoodBatch.register(input, now)
  const offer = batch.offerTo({ institutionId, score: 0.8, now, timeoutMinutes: 30 })

  return { batch, offer }
}

describe('FoodBatch (agregado)', () => {
  describe('cadastro', () => {
    it('nasce AVAILABLE, sem ofertas e com id próprio', () => {
      const batch = FoodBatch.register(input, now)

      expect(batch.id).toEqual(expect.any(String))
      expect(batch.status).toBe('AVAILABLE')
      expect(batch.offers).toEqual([])
      expect(batch.createdAt).toEqual(now)
    })

    it('valida quantidade, validade e coordenadas, nessa ordem', () => {
      expect(() => FoodBatch.register({ ...input, quantityKg: 0 }, now)).toThrow(
        InvalidBatchQuantityError,
      )
      expect(() =>
        FoodBatch.register({ ...input, quantityKg: Number.NaN }, now),
      ).toThrow(InvalidBatchQuantityError)
      expect(() => FoodBatch.register({ ...input, expiresAt: now }, now)).toThrow(
        BatchAlreadyExpiredError,
      )
      expect(() => FoodBatch.register({ ...input, latitude: 91 }, now)).toThrow(
        InvalidCoordinatesError,
      )
    })
  })

  describe('oferta (RN06: uma por vez)', () => {
    it('cria a oferta PENDING com prazo e marca o lote como OFFERED', () => {
      const { batch, offer } = offeredBatch()

      expect(batch.status).toBe('OFFERED')
      expect(batch.activeOffer).toBe(offer)
      expect(offer).toMatchObject({
        batchId: batch.id,
        institutionId: 'inst-a',
        score: 0.8,
        status: 'PENDING',
        respondedAt: null,
      })
      expect(offer.expiresAt).toEqual(minutesLater(30))
    })

    it('não oferece a uma segunda instituição enquanto há oferta ativa', () => {
      const { batch } = offeredBatch()

      expect(() =>
        batch.offerTo({ institutionId: 'inst-b', score: 0.5, now, timeoutMinutes: 30 }),
      ).toThrow(BatchNotAvailableError)
    })

    it('não oferece lote vencido', () => {
      const batch = FoodBatch.register(input, now)

      expect(() =>
        batch.offerTo({
          institutionId: 'inst-a',
          score: 1,
          now: input.expiresAt,
          timeoutMinutes: 30,
        }),
      ).toThrow(BatchNotAvailableError)
    })
  })

  describe('resposta da instituição', () => {
    it('aceitar dentro do prazo reserva o lote', () => {
      const { batch, offer } = offeredBatch()

      batch.acceptOffer(offer.id, 'inst-a', minutesLater(5))

      expect(offer.status).toBe('ACCEPTED')
      expect(offer.respondedAt).toEqual(minutesLater(5))
      expect(batch.status).toBe('RESERVED')
    })

    it('não aceita depois do prazo (RN04)', () => {
      const { batch, offer } = offeredBatch()

      expect(() => batch.acceptOffer(offer.id, 'inst-a', minutesLater(30))).toThrow(
        OfferExpiredError,
      )
    })

    it('só a instituição ofertada pode responder', () => {
      const { batch, offer } = offeredBatch()

      expect(() => batch.acceptOffer(offer.id, 'inst-b', now)).toThrow(
        OfferForAnotherInstitutionError,
      )
      expect(() => batch.declineOffer(offer.id, 'inst-b', now)).toThrow(
        OfferForAnotherInstitutionError,
      )
    })

    it('recusar devolve o lote à fila e tira a instituição dela (RN08)', () => {
      const { batch, offer } = offeredBatch()

      batch.declineOffer(offer.id, 'inst-a', minutesLater(2))

      expect(offer.status).toBe('DECLINED')
      expect(batch.status).toBe('AVAILABLE')
      expect([...batch.institutionsAlreadyTried()]).toEqual(['inst-a'])
    })

    it('não responde duas vezes', () => {
      const { batch, offer } = offeredBatch()

      batch.acceptOffer(offer.id, 'inst-a', now)

      expect(() => batch.declineOffer(offer.id, 'inst-a', now)).toThrow(
        InvalidOfferStateError,
      )
    })

    it('oferta de outro lote não é encontrada', () => {
      const { batch } = offeredBatch()

      expect(() => batch.acceptOffer('outra', 'inst-a', now)).toThrow(ResourceNotFoundError)
    })
  })

  describe('prazo e validade', () => {
    it('oferta sem resposta expira no prazo e o lote volta à fila', () => {
      const { batch, offer } = offeredBatch()

      expect(batch.expireOverdueOffers(minutesLater(29))).toEqual([])
      expect(batch.status).toBe('OFFERED')

      expect(batch.expireOverdueOffers(minutesLater(30))).toEqual([offer])
      expect(offer.status).toBe('EXPIRED')
      expect(batch.status).toBe('AVAILABLE')
      expect([...batch.institutionsAlreadyTried()]).toEqual(['inst-a'])
    })

    it('lote vencido sem aceite sai de circulação e encerra a oferta pendente', () => {
      const { batch, offer } = offeredBatch()

      expect(batch.expireIfPastValidity(minutesLater(119))).toBe(false)
      expect(batch.expireIfPastValidity(input.expiresAt)).toBe(true)

      expect(batch.status).toBe('EXPIRED')
      expect(offer.status).toBe('EXPIRED')
      expect(batch.isOpen).toBe(false)
    })

    it('lote já aceito não vence: a instituição está a caminho', () => {
      const { batch, offer } = offeredBatch()

      batch.acceptOffer(offer.id, 'inst-a', now)

      expect(batch.expireIfPastValidity(input.expiresAt)).toBe(false)
      expect(batch.status).toBe('RESERVED')
    })
  })

  describe('retirada', () => {
    it('só depois do aceite, só por quem aceitou e só uma vez', () => {
      const { batch, offer } = offeredBatch()

      expect(() => batch.completePickup(offer.id, 'inst-a')).toThrow(
        InvalidOfferStateError,
      )

      batch.acceptOffer(offer.id, 'inst-a', minutesLater(5))

      expect(() => batch.completePickup(offer.id, 'inst-b')).toThrow(
        OfferForAnotherInstitutionError,
      )

      batch.completePickup(offer.id, 'inst-a')

      expect(batch.status).toBe('COLLECTED')
      expect(() => batch.completePickup(offer.id, 'inst-a')).toThrow(
        InvalidOfferStateError,
      )
    })
  })
})
