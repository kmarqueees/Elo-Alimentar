import { beforeEach, describe, expect, it } from 'vitest'
import { AddCollectedDonationToStock } from '@/application/subscribers/add-collected-donation-to-stock'
import { NotifyOfferEvents } from '@/application/subscribers/notify-offer-events'
import { InMemoryNotificationsRepository } from '@/infra/database/in-memory/in-memory-notifications-repository'
import { DomainEventPublisher } from '@/core/events/domain-event-publisher'
import { DonationCollected } from '@/domain/food-batch/events/donation-collected'
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
let notifications: InMemoryNotificationsRepository

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
      storageCapacityKg: 100,
      acceptedFoodTypes: [],
      validated: true,
      ...overrides,
    }),
  )
}

async function registerBatch(expiresAt = new Date('2026-10-16T14:00:00Z'), quantityKg = 18) {
  const { batch } = await register.execute({
    donorId: 'donor-1',
    foodType: 'HORTIFRUTI',
    quantityKg,
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

    notifications = new InMemoryNotificationsRepository()

    const events = new DomainEventPublisher()
    const addToStock = new AddCollectedDonationToStock(institutions)

    events.subscribe(DonationCollected, (event) => addToStock.handle(event))
    new NotifyOfferEvents(notifications, institutions).subscribeTo(events)

    register = new RegisterFoodBatchUseCase(
      batches,
      new InMemoryDonorsRepository(),
      institutions,
      offers,
      events,
    )
    accept = new AcceptOfferUseCase(batches, events)
    decline = new DeclineOfferUseCase(batches, institutions, offers, events)
    pickup = new CompletePickupUseCase(batches, events)
    advance = new AdvanceOfferQueueUseCase(batches, institutions, offers, events)
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
      reminders: 0,
    })
    expect(await advance.execute({ now: minutesLater(30) })).toEqual({
      expiredOffers: 1,
      newOffers: 1,
      expiredBatches: 0,
      reminders: 0,
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

    await expect(pickup.execute({ offerId, institutionId: 'a', now: minutesLater(40) })).rejects.toBeInstanceOf(
      InvalidOfferStateError,
    )

    await accept.execute({ offerId, institutionId: 'a', now: minutesLater(5) })
    expect(batch.status).toBe('RESERVED')

    await pickup.execute({ offerId, institutionId: 'a', now: minutesLater(40) })
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

  describe('necessidade e limite de recebimento', () => {
    it('oferece primeiro a quem está com o estoque acabando', async () => {
      // 'perto' tem estoque para 10 dias; 'precisando' para meio dia (40 pessoas → 20 kg/dia).
      await makeInstitution('perto', 1, { peopleServed: 40, stockKg: 200, storageCapacityKg: 400 })
      await makeInstitution('precisando', 3, { peopleServed: 40, stockKg: 10 })

      const batch = await registerBatch()

      expect(current(batch).institutionId).toBe('precisando')
    })

    it('no máximo 2 lotes em aberto por instituição: o 3º vai para a próxima', async () => {
      await makeInstitution('a', 1)
      await makeInstitution('b', 2)

      const first = await registerBatch()
      const second = await registerBatch()
      const third = await registerBatch()

      expect([first, second, third].map((b) => current(b).institutionId)).toEqual(['a', 'a', 'b'])
    })

    it('com vagas escassas, a varredura atende primeiro os lotes que vencem antes', async () => {
      // Sem instituição no cadastro: os três lotes ficam esperando (AVAILABLE).
      const later = await registerBatch(minutesLater(600))
      const soon = await registerBatch(minutesLater(60))
      const middle = await registerBatch(minutesLater(180))

      // Aparece uma única instituição, com vaga para 2 lotes.
      await makeInstitution('a', 1, { storageCapacityKg: 1000 })
      await advance.execute({ now: minutesLater(1) })

      expect(soon.status).toBe('OFFERED')
      expect(middle.status).toBe('OFFERED')
      expect(later.status).toBe('AVAILABLE')
    })

    it('lote que não cabe no armazenamento vai para quem tem espaço', async () => {
      await makeInstitution('sem-espaco', 1, { storageCapacityKg: 30 })
      await makeInstitution('com-espaco', 2, { storageCapacityKg: 100 })

      // 18 kg cabem nos 30 kg; o 2º lote somaria 36 kg e passa para quem tem espaço.
      const first = await registerBatch()
      const second = await registerBatch()

      expect(current(first).institutionId).toBe('sem-espaco')
      expect(current(second).institutionId).toBe('com-espaco')
    })

    it('a retirada soma o lote ao estoque da instituição', async () => {
      await makeInstitution('a', 1, { peopleServed: 40, stockKg: 10 })
      const batch = await registerBatch()
      const offerId = current(batch).id

      await accept.execute({ offerId, institutionId: 'a', now: minutesLater(5) })
      await pickup.execute({ offerId, institutionId: 'a', now })

      const institution = await institutions.findById('a')

      expect(institution!.estimatedStockKg(now)).toBe(28)
    })

    it('depois de retirar, a instituição volta a ter vaga para novos lotes', async () => {
      await makeInstitution('a', 1, { storageCapacityKg: 1000 })
      await makeInstitution('b', 5, { storageCapacityKg: 1000 })

      const first = await registerBatch()
      await registerBatch()

      await accept.execute({ offerId: current(first).id, institutionId: 'a', now })
      await pickup.execute({ offerId: current(first).id, institutionId: 'a', now })

      const third = await registerBatch()

      expect(current(third).institutionId).toBe('a')
    })
  })

  describe('notificações', () => {
    const inbox = (recipientId: string) =>
      notifications.items
        .filter((n) => n.recipientId === recipientId)
        .map((n) => n.type)

    it('a instituição é avisada da nova oferta, com o prazo para responder', async () => {
      await makeInstitution('a', 1)
      const batch = await registerBatch()

      const [notification] = notifications.items

      expect(notification).toMatchObject({
        recipientType: 'INSTITUTION',
        recipientId: 'a',
        type: 'OFFER_RECEIVED',
        title: 'Nova doação para você',
        batchId: batch.id,
        offerId: current(batch).id,
      })
      expect(notification!.message).toBe(
        '18 kg de hortifruti disponíveis para a sua instituição. Você tem 30 minutos para aceitar ou recusar.',
      )
    })

    it('lembrete quando faltam 10 minutos, uma única vez', async () => {
      await makeInstitution('a', 1)
      await registerBatch()

      await advance.execute({ now: minutesLater(19) })
      expect((await advance.execute({ now: minutesLater(20) })).reminders).toBe(1)
      await advance.execute({ now: minutesLater(25) })

      expect(inbox('a')).toEqual(['OFFER_RECEIVED', 'OFFER_REMINDER'])
    })

    it('recusa: o doador é avisado e a próxima instituição recebe a oferta', async () => {
      await makeInstitution('a', 1)
      await makeInstitution('b', 2)
      const batch = await registerBatch()

      await decline.execute({ offerId: current(batch).id, institutionId: 'a', now })

      expect(inbox('donor-1')).toEqual(['OFFER_DECLINED'])
      expect(inbox('b')).toEqual(['OFFER_RECEIVED'])
      expect(notifications.items.find((n) => n.type === 'OFFER_DECLINED')!.title).toBe('a recusou a doação')
    })

    it('prazo esgotado: avisa a instituição, o doador e a próxima da fila', async () => {
      await makeInstitution('a', 1)
      await makeInstitution('b', 2)
      await registerBatch()

      await advance.execute({ now: minutesLater(30) })

      expect(inbox('a')).toEqual(['OFFER_RECEIVED', 'OFFER_TIMED_OUT'])
      expect(inbox('donor-1')).toEqual(['OFFER_EXPIRED'])
      expect(inbox('b')).toEqual(['OFFER_RECEIVED'])
    })

    it('sem instituição disponível: o doador é avisado uma vez, não a cada varredura', async () => {
      await registerBatch()
      await advance.execute({ now: minutesLater(1) })
      await advance.execute({ now: minutesLater(2) })

      expect(inbox('donor-1')).toEqual(['WAITING_FOR_INSTITUTION'])
    })

    it('aceite e retirada avisam o doador', async () => {
      await makeInstitution('a', 1)
      const batch = await registerBatch()
      const offerId = current(batch).id

      await accept.execute({ offerId, institutionId: 'a', now })
      await pickup.execute({ offerId, institutionId: 'a', now })

      expect(inbox('donor-1')).toEqual(['OFFER_ACCEPTED', 'DONATION_COLLECTED'])
    })

    it('lote vencido sem aceite avisa o doador', async () => {
      await makeInstitution('a', 1)
      await registerBatch(minutesLater(20))

      await advance.execute({ now: minutesLater(20) })

      expect(inbox('donor-1')).toEqual(['BATCH_EXPIRED'])
      expect(inbox('a')).toEqual(['OFFER_RECEIVED', 'OFFER_TIMED_OUT'])
      expect(notifications.items.at(-2)!.message).toBe('A doação de 18 kg de hortifruti venceu antes da sua resposta.')
    })
  })
})
