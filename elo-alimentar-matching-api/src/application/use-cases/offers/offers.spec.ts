import { beforeEach, describe, expect, it } from 'vitest'
import { InvalidOfferStateError } from '@/domain/food-batch/errors/invalid-offer-state-error'
import { OfferExpiredError } from '@/domain/food-batch/errors/offer-expired-error'
import { OfferForAnotherInstitutionError } from '@/domain/food-batch/errors/offer-for-another-institution-error'
import type { FoodBatch } from '@/domain/food-batch/food-batch'
import { EligibleInstitutionsRanker } from '@/domain/matching/eligible-institutions-ranker'
import { SequentialOfferService } from '@/domain/matching/sequential-offer-service'
import { MultiCriteriaStrategy } from '@/domain/matching/strategies/multi-criteria-strategy'
import { InMemoryDonorsRepository } from '@/infra/database/in-memory/in-memory-donors-repository'
import { InMemoryFoodBatchesRepository } from '@/infra/database/in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '@/infra/database/in-memory/in-memory-institutions-repository'
import { makeInstitution as buildInstitution } from '@/test/factories/make-institution'
import { RegisterFoodBatchUseCase } from '../food-batches/register-food-batch'
import { AcceptOfferUseCase } from './accept-offer'
import { AdvanceOfferQueueUseCase } from './advance-offer-queue'
import { CompletePickupUseCase } from './complete-pickup'
import { DeclineOfferUseCase } from './decline-offer'
import { ListInstitutionOffersUseCase } from './list-institution-offers'

let batches: InMemoryFoodBatchesRepository
let institutions: InMemoryInstitutionsRepository
let register: RegisterFoodBatchUseCase
let accept: AcceptOfferUseCase
let decline: DeclineOfferUseCase
let pickup: CompletePickupUseCase
let advance: AdvanceOfferQueueUseCase

const now = new Date('2026-10-16T12:00:00Z')
const minutesLater = (m: number) => new Date(now.getTime() + m * 60_000)
const KM = 0.009

/** Com geladeira e mais perto = melhor posição no ranking multicritério. */
function makeInstitution(id: string, kmAway: number, overrides = {}) {
  return institutions.create(
    buildInstitution({
      id,
      name: id,
      latitude: -3.1 + kmAway * KM,
      longitude: -60.0,
      hasRefrigeration: true,
      availableCapacityKg: 100,
      acceptedFoodTypes: [],
      validated: true,
      ...overrides,
    }),
  )
}

async function registerBatch(expiresAt = new Date('2026-10-16T14:00:00Z')) {
  const { batch } = await register.execute({
    donorId: 'donor-1',
    foodType: 'HORTIFRUTI',
    quantityKg: 18,
    expiresAt,
    storageCondition: 'REFRIGERATED',
    latitude: -3.1,
    longitude: -60.0,
    now,
  })

  return batch
}

const current = (batch: FoodBatch) => batch.activeOffer!

describe('Oferta sequencial: oferecer, aceitar, recusar, expirar e retirar', () => {
  beforeEach(() => {
    batches = new InMemoryFoodBatchesRepository()
    institutions = new InMemoryInstitutionsRepository()

    const offers = new SequentialOfferService(
      new EligibleInstitutionsRanker(new MultiCriteriaStrategy()),
      30,
    )

    register = new RegisterFoodBatchUseCase(
      batches,
      new InMemoryDonorsRepository(),
      institutions,
      offers,
    )
    accept = new AcceptOfferUseCase(batches)
    decline = new DeclineOfferUseCase(batches, institutions, offers)
    pickup = new CompletePickupUseCase(batches)
    advance = new AdvanceOfferQueueUseCase(batches, institutions, offers)
  })

  it('ao cadastrar, oferece só à 1ª do ranking, com prazo de 30 min', async () => {
    await makeInstitution('segunda', 3)
    await makeInstitution('primeira', 1)

    const batch = await registerBatch()

    expect(batch.status).toBe('OFFERED')
    expect(batch.offers).toHaveLength(1)
    expect(current(batch)).toMatchObject({ institutionId: 'primeira', status: 'PENDING' })
    expect(current(batch).expiresAt).toEqual(minutesLater(30))
  })

  it('nunca oferece a quem não pode receber, como instituição sem geladeira (RN01)', async () => {
    await makeInstitution('sem-geladeira', 1, { hasRefrigeration: false })
    await makeInstitution('com-geladeira', 4)

    const batch = await registerBatch()

    expect(current(batch).institutionId).toBe('com-geladeira')
  })

  it('sem instituição elegível o lote fica AVAILABLE até aparecer uma', async () => {
    const batch = await registerBatch()

    expect(batch.status).toBe('AVAILABLE')

    await makeInstitution('nova', 1)
    const result = await advance.execute({ now: minutesLater(1) })

    expect(result.newOffers).toBe(1)
    expect(current(batch).institutionId).toBe('nova')
  })

  it('recusa: oferece na hora à próxima e não volta para quem recusou (RN08)', async () => {
    await makeInstitution('a', 1)
    await makeInstitution('b', 2)
    const batch = await registerBatch()

    const { offer, nextOffer } = await decline.execute({
      offerId: current(batch).id,
      institutionId: 'a',
      now: minutesLater(3),
    })

    expect(offer.status).toBe('DECLINED')
    expect(nextOffer?.institutionId).toBe('b')
    expect(batch.status).toBe('OFFERED')
    expect(batch.offers.map((o) => [o.institutionId, o.status])).toEqual([
      ['a', 'DECLINED'],
      ['b', 'PENDING'],
    ])
  })

  it('sem resposta em 30 min a oferta expira e o lote segue para a próxima (RN04, RN08)', async () => {
    await makeInstitution('a', 1)
    await makeInstitution('b', 2)
    const batch = await registerBatch()

    expect(await advance.execute({ now: minutesLater(10) })).toEqual({
      expiredOffers: 0,
      newOffers: 0,
      expiredBatches: 0,
    })
    expect(await advance.execute({ now: minutesLater(30) })).toEqual({
      expiredOffers: 1,
      newOffers: 1,
      expiredBatches: 0,
    })

    expect(current(batch).institutionId).toBe('b')
    expect(current(batch).expiresAt).toEqual(minutesLater(60))
  })

  it('quando a fila acaba, o lote fica AVAILABLE sem oferta', async () => {
    await makeInstitution('a', 1)
    const batch = await registerBatch()

    const { nextOffer } = await decline.execute({
      offerId: current(batch).id,
      institutionId: 'a',
      now,
    })

    expect(nextOffer).toBeNull()
    expect(batch.status).toBe('AVAILABLE')
    expect(batch.activeOffer).toBeNull()
  })

  it('lote que vence sem aceite vira EXPIRED na varredura', async () => {
    await makeInstitution('a', 1)
    const batch = await registerBatch(minutesLater(20))

    const result = await advance.execute({ now: minutesLater(20) })

    expect(result.expiredBatches).toBe(1)
    expect(batch.status).toBe('EXPIRED')
  })

  it('não aceita depois do prazo, nem oferta feita a outra instituição', async () => {
    await makeInstitution('a', 1)
    const batch = await registerBatch()
    const offerId = current(batch).id

    await expect(
      accept.execute({ offerId, institutionId: 'outra', now }),
    ).rejects.toBeInstanceOf(OfferForAnotherInstitutionError)
    await expect(
      accept.execute({ offerId, institutionId: 'a', now: minutesLater(31) }),
    ).rejects.toBeInstanceOf(OfferExpiredError)
  })

  it('aceitar e retirar leva o lote a COLLECTED; retirar sem aceitar é bloqueado', async () => {
    await makeInstitution('a', 1)
    const batch = await registerBatch()
    const offerId = current(batch).id

    await expect(pickup.execute({ offerId, institutionId: 'a' })).rejects.toBeInstanceOf(
      InvalidOfferStateError,
    )

    await accept.execute({ offerId, institutionId: 'a', now: minutesLater(5) })
    expect(batch.status).toBe('RESERVED')

    await pickup.execute({ offerId, institutionId: 'a' })
    expect(batch.status).toBe('COLLECTED')
  })

  it('a instituição vê só as ofertas feitas a ela', async () => {
    await makeInstitution('a', 1)
    await makeInstitution('b', 2)
    const batch = await registerBatch()
    const list = new ListInstitutionOffersUseCase(batches, institutions)

    expect((await list.execute({ institutionId: 'a' })).offers).toHaveLength(1)
    expect((await list.execute({ institutionId: 'b' })).offers).toHaveLength(0)

    await decline.execute({ offerId: current(batch).id, institutionId: 'a', now })

    const forB = (await list.execute({ institutionId: 'b' })).offers

    expect(forB.map(({ offer }) => offer.status)).toEqual(['PENDING'])
  })
})
