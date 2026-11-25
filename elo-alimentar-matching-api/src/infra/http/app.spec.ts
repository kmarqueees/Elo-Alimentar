import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { InMemoryDonorsRepository } from '@/infra/database/in-memory/in-memory-donors-repository'
import { InMemoryFoodBatchesRepository } from '@/infra/database/in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '@/infra/database/in-memory/in-memory-institutions-repository'
import { InMemoryNotificationsRepository } from '@/infra/database/in-memory/in-memory-notifications-repository'
import type { AddressServices } from '@/main/container'
import { ExternalServiceUnavailableError } from '@/core/errors/external-service-unavailable-error'
import type { UseCases } from '@/infra/http/http-dependencies'
import { makeApp } from '@/main/make-app'
import {
  SCENARIO_NOW,
  batchFromScenario,
  generateScenario,
  institutionFromScenario,
} from '@/simulation/scenario'
import { makeInstitution } from '@/test/factories/make-institution'

let app: FastifyInstance
let useCases: UseCases
let batchesRepository: InMemoryFoodBatchesRepository
let institutionsRepository: InMemoryInstitutionsRepository

const NOW = new Date('2026-10-16T12:00:00Z')
/** Relógio da API nos testes; avance-o para simular o prazo de 30 min. */
let now = NOW
const minutesLater = (m: number) => new Date(NOW.getTime() + m * 60_000)

const batchBody = {
  donorId: 'donor-1',
  foodType: 'HORTIFRUTI',
  quantityKg: 18,
  expiresAt: '2026-10-16T14:00:00Z',
  storageCondition: 'REFRIGERATED',
  latitude: -3.119,
  longitude: -60.0217,
}

const nearNoFridge = {
  name: 'ONG perto, sem geladeira',
  latitude: -3.11,
  longitude: -60.0217,
  hasRefrigeration: false,
  storageCapacityKg: 100,
  peopleServed: 50,
}

const farWithFridge = {
  name: 'ONG longe, com geladeira',
  latitude: -3.083,
  longitude: -60.0217,
  hasRefrigeration: true,
  storageCapacityKg: 100,
  peopleServed: 50,
}

/** Serviços de endereço simulados: nenhum teste acessa ViaCEP ou Nominatim. */
const addressServices: AddressServices = {
  postalCodes: {
    async findByPostalCode(postalCode) {
      if (postalCode === '99999999') throw new ExternalServiceUnavailableError('viacep')

      return postalCode === '69005040'
        ? { postalCode, street: 'Avenida Eduardo Ribeiro', district: 'Centro', city: 'Manaus', state: 'AM' }
        : null
    },
  },
  geocoder: {
    async search(query) {
      return query.includes('Eduardo Ribeiro')
        ? [{
            label: 'Avenida Eduardo Ribeiro, 520, Centro, Manaus, Amazonas, Brasil',
            latitude: -3.1316,
            longitude: -60.0234,
            street: 'Avenida Eduardo Ribeiro',
            number: '520',
            district: 'Centro',
            city: 'Manaus',
            state: 'AM',
            postalCode: '69005040',
          }]
        : []
    },
  },
}

async function post(url: string, payload: unknown) {
  return app.inject({ method: 'POST', url, payload: payload as object })
}

describe('API HTTP', () => {
  beforeEach(async () => {
    batchesRepository = new InMemoryFoodBatchesRepository()
    institutionsRepository = new InMemoryInstitutionsRepository()
    now = NOW
    ;({ app, useCases } = makeApp({
      batchesRepository,
      institutionsRepository,
      donorsRepository: new InMemoryDonorsRepository(),
      notificationsRepository: new InMemoryNotificationsRepository(),
      clock: () => now,
      addressServices,
    }))
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('responde ao preflight de CORS e libera a origem', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/batches',
      headers: { origin: 'null', 'access-control-request-method': 'POST' },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('*')
  })

  it('GET /health responde ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toEqual(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  describe('instituições', () => {
    it('POST /institutions cria a instituição como NÃO validada (RN03)', async () => {
      const response = await post('/institutions', nearNoFridge)

      expect(response.statusCode).toEqual(201)
      expect(response.json().institution).toMatchObject({
        name: nearNoFridge.name,
        validated: false,
        acceptedFoodTypes: [],
      })
    })

    it('POST /institutions rejeita dados inválidos com 400', async () => {
      const response = await post('/institutions', {
        ...nearNoFridge,
        storageCapacityKg: 0,
      })

      expect(response.statusCode).toEqual(400)
    })

    it('POST /institutions rejeita tipo de alimento desconhecido', async () => {
      const response = await post('/institutions', {
        ...nearNoFridge,
        acceptedFoodTypes: ['PIZZA'],
      })

      expect(response.statusCode).toEqual(400)
      expect(response.json().message).toEqual('Validation error.')
    })

    it('PATCH /institutions/:id/validate valida a instituição', async () => {
      const created = await post('/institutions', nearNoFridge)
      const id = created.json().institution.id

      const response = await app.inject({
        method: 'PATCH',
        url: `/institutions/${id}/validate`,
      })

      expect(response.statusCode).toEqual(200)
      expect(response.json().institution.validated).toEqual(true)
    })

    it('PATCH /institutions/:id/validate devolve 404 se não existir', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/institutions/nao-existe/validate',
      })

      expect(response.statusCode).toEqual(404)
    })

    it('PATCH /institutions/:id/stock atualiza o estoque e recalcula os dias de estoque', async () => {
      const created = await post('/institutions', { ...nearNoFridge, stockKg: 25 })
      const id = created.json().institution.id

      // 50 pessoas × 0,5 kg = 25 kg/dia
      expect(created.json().institution).toMatchObject({
        peopleServed: 50,
        dailyConsumptionKg: 25,
        estimatedStockKg: 25,
        stockDays: 1,
      })

      const updated = await app.inject({
        method: 'PATCH',
        url: `/institutions/${id}/stock`,
        payload: { stockKg: 100 },
      })
      const invalid = await app.inject({
        method: 'PATCH',
        url: `/institutions/${id}/stock`,
        payload: { stockKg: -1 },
      })

      expect(updated.json().institution).toMatchObject({ estimatedStockKg: 100, stockDays: 4 })
      expect(invalid.statusCode).toBe(400)
    })

    it('POST /institutions exige pessoas atendidas', async () => {
      const { peopleServed: _omit, ...withoutPeople } = nearNoFridge
      const missing = await post('/institutions', withoutPeople)
      const zero = await post('/institutions', { ...nearNoFridge, peopleServed: 0 })

      expect(missing.statusCode).toBe(400)
      expect(zero.statusCode).toBe(400)
    })

    it('GET /institutions lista todas, validadas ou não', async () => {
      await post('/institutions', nearNoFridge)
      await post('/institutions', farWithFridge)

      const response = await app.inject({ method: 'GET', url: '/institutions' })

      expect(response.json().institutions).toHaveLength(2)
    })
  })

  describe('lotes', () => {
    it('POST /batches cadastra o lote como disponível', async () => {
      const response = await post('/batches', batchBody)

      expect(response.statusCode).toEqual(201)
      expect(response.json().batch).toMatchObject({
        status: 'AVAILABLE',
        foodType: 'HORTIFRUTI',
        quantityKg: 18,
      })
    })

    it('POST /batches rejeita lote já vencido com 400', async () => {
      const response = await post('/batches', {
        ...batchBody,
        expiresAt: '2026-10-16T11:00:00Z',
      })

      expect(response.statusCode).toEqual(400)
      expect(response.json().message).toEqual(
        'Batch expiration date must be in the future.',
      )
    })

    it('POST /batches rejeita quantidade zero com 400', async () => {
      const response = await post('/batches', { ...batchBody, quantityKg: 0 })

      expect(response.statusCode).toEqual(400)
    })

    it('POST /batches rejeita data em formato inválido com 400', async () => {
      const response = await post('/batches', {
        ...batchBody,
        expiresAt: 'amanhã',
      })

      expect(response.statusCode).toEqual(400)
    })

    it('POST /batches com JSON malformado devolve 400, não 500', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/batches',
        headers: { 'content-type': 'application/json' },
        payload: '{ isso não é json',
      })

      expect(response.statusCode).toEqual(400)
    })

    it('GET /batches lista os disponíveis e GET /batches/:id busca um', async () => {
      const created = await post('/batches', batchBody)
      const id = created.json().batch.id

      const list = await app.inject({ method: 'GET', url: '/batches' })
      const one = await app.inject({ method: 'GET', url: `/batches/${id}` })

      expect(list.json().batches).toHaveLength(1)
      expect(one.statusCode).toEqual(200)
      expect(one.json().batch.id).toEqual(id)
    })

    it('GET /batches/:id devolve 404 se não existir', async () => {
      const response = await app.inject({ method: 'GET', url: '/batches/nao-existe' })

      expect(response.statusCode).toEqual(404)
    })
  })

  describe('matching', () => {
    async function seedStory() {
      const near = (await post('/institutions', nearNoFridge)).json().institution
      const far = (await post('/institutions', farWithFridge)).json().institution
      const batch = (await post('/batches', batchBody)).json().batch

      return { near, far, batch }
    }

    it('não inclui instituições não validadas no ranking (RN03)', async () => {
      const { batch } = await seedStory()

      const response = await app.inject({
        method: 'GET',
        url: `/batches/${batch.id}/matches`,
      })

      expect(response.statusCode).toEqual(200)
      expect(response.json().ranking).toEqual([])
    })

    it('só distância indica a ONG perto (sem geladeira); multicritério indica a que tem geladeira (RN01)', async () => {
      const { near, far, batch } = await seedStory()

      await app.inject({ method: 'PATCH', url: `/institutions/${near.id}/validate` })
      await app.inject({ method: 'PATCH', url: `/institutions/${far.id}/validate` })

      const distance = await app.inject({
        method: 'GET',
        url: `/batches/${batch.id}/matches?strategy=distance`,
      })
      const multi = await app.inject({
        method: 'GET',
        url: `/batches/${batch.id}/matches?strategy=multicriteria`,
      })

      expect(distance.json().ranking[0].institution.id).toEqual(near.id)
      expect(distance.json().ranking).toHaveLength(2)

      expect(multi.json().ranking).toHaveLength(1)
      expect(multi.json().ranking[0].institution.id).toEqual(far.id)
      expect(multi.json().ranking[0].position).toEqual(1)
      expect(multi.json().hoursUntilExpiry).toEqual(2)
    })

    it('usa multicritério por padrão', async () => {
      const { near, far, batch } = await seedStory()

      await app.inject({ method: 'PATCH', url: `/institutions/${near.id}/validate` })
      await app.inject({ method: 'PATCH', url: `/institutions/${far.id}/validate` })

      const response = await app.inject({
        method: 'GET',
        url: `/batches/${batch.id}/matches`,
      })

      expect(response.json().strategy).toEqual('multicriteria')
    })

    it('rejeita estratégia desconhecida com 400', async () => {
      const { batch } = await seedStory()

      const response = await app.inject({
        method: 'GET',
        url: `/batches/${batch.id}/matches?strategy=aleatorio`,
      })

      expect(response.statusCode).toEqual(400)
    })

    it('devolve 404 para lote inexistente e 409 para lote já retirado', async () => {
      const { far, batch } = await seedStory()

      const missing = await app.inject({
        method: 'GET',
        url: '/batches/nao-existe/matches',
      })

      const stored = await batchesRepository.findById(batch.id)
      const offer = stored!.offerTo({ institutionId: far.id, score: 1, now: NOW, timeoutMinutes: 30 })
      stored!.acceptOffer(offer.id, far.id, NOW)
      stored!.completePickup(offer.id, far.id, NOW)

      const collected = await app.inject({
        method: 'GET',
        url: `/batches/${batch.id}/matches`,
      })

      expect(missing.statusCode).toEqual(404)
      expect(collected.statusCode).toEqual(409)
    })
  })

  describe('comparação', () => {
    it('GET /comparison reproduz os números da simulação (semente 42)', async () => {
      const { institutions, batches } = generateScenario(42)

      for (const institution of institutions) {
        await institutionsRepository.create(institutionFromScenario(institution))
      }

      for (const batch of batches) {
        await batchesRepository.create(batchFromScenario(batch))
      }

      const response = await app.inject({
        method: 'GET',
        url: `/comparison?now=${SCENARIO_NOW.toISOString()}`,
      })

      const body = response.json()

      expect(response.statusCode).toEqual(200)
      expect(body.strategies).toHaveLength(2)
      expect(body.strategies[0]).toMatchObject({
        strategy: 'Somente distância',
        collectedBatches: 19,
        totalBatches: 20,
      })
      expect(body.strategies[1]).toMatchObject({
        strategy: 'Multicritério',
        collectedBatches: 20,
        firstChoiceViablePercent: 100,
      })
      // 65,3% antes do critério de necessidade: ele troca um pouco de velocidade por priorizar quem tem menos estoque.
      expect(body.timeReductionPercent).toEqual(64.5)
    })

    it('GET /comparison funciona sem dados', async () => {
      const response = await app.inject({ method: 'GET', url: '/comparison' })

      expect(response.statusCode).toEqual(200)
      expect(response.json().timeReductionPercent).toBeNull()
    })
  })

  describe('oferta sequencial (RN04, RN06, RN08)', () => {
    /** 'Primeira' fica mais perto e tem geladeira; 'Segunda' tem geladeira mas está mais longe. */
    async function scenario() {
      const first = makeInstitution({ ...farWithFridge, acceptedFoodTypes: [], name: 'Primeira', latitude: -3.11, validated: true })
      const second = makeInstitution({ ...farWithFridge, acceptedFoodTypes: [], name: 'Segunda', validated: true })
      const noFridge = makeInstitution({ ...nearNoFridge, acceptedFoodTypes: [], validated: true })

      for (const institution of [first, second, noFridge]) {
        await institutionsRepository.create(institution)
      }

      const created = await post('/batches', batchBody)
      const batch = created.json().batch

      return { first, second, noFridge, batch, created }
    }

    const offersOf = async (batchId: string) =>
      (await app.inject({ method: 'GET', url: `/batches/${batchId}/offers` })).json().offers

    const inbox = async (institutionId: string) =>
      (await app.inject({ method: 'GET', url: `/institutions/${institutionId}/offers` })).json().offers

    const respond = (offerId: string, action: 'accept' | 'decline' | 'pickup', institutionId: string) =>
      app.inject({ method: 'PATCH', url: `/offers/${offerId}/${action}`, payload: { institutionId } })

    it('ao cadastrar, o lote é oferecido só à 1ª do ranking', async () => {
      const { first, second, noFridge, batch, created } = await scenario()

      expect(created.statusCode).toBe(201)
      expect(batch.status).toBe('OFFERED')

      const offers = await offersOf(batch.id)

      expect(offers).toHaveLength(1)
      expect(offers[0]).toMatchObject({ institutionId: first.id, status: 'PENDING' })
      expect(offers[0].expiresAt).toBe(minutesLater(30).toISOString())

      expect(await inbox(first.id)).toHaveLength(1)
      expect(await inbox(second.id)).toEqual([])
      expect(await inbox(noFridge.id)).toEqual([])
    })

    it('a instituição vê a oferta sem nota, posição ou dados de outras', async () => {
      const { first } = await scenario()

      const [item] = await inbox(first.id)

      expect(item.offer).not.toHaveProperty('score')
      expect(item.batch).toMatchObject({ foodType: 'HORTIFRUTI', status: 'OFFERED' })
    })

    it('recusa: a oferta vai na hora para a próxima e quem recusou sai da fila (RN08)', async () => {
      const { first, second, batch } = await scenario()
      const [{ offer }] = await inbox(first.id)

      const declined = await respond(offer.id, 'decline', first.id)

      expect(declined.statusCode).toBe(200)
      expect(declined.json()).toMatchObject({ offer: { status: 'DECLINED' }, offeredToNext: true })
      expect((await inbox(second.id)).map((i: { offer: { status: string } }) => i.offer.status)).toEqual(['PENDING'])

      const matches = (await app.inject({ method: 'GET', url: `/batches/${batch.id}/matches` })).json()

      expect(matches.ranking.map((r: { institution: { id: string } }) => r.institution.id)).toEqual([second.id])
    })

    it('sem resposta em 30 min a oferta expira e passa para a próxima (RN04)', async () => {
      const { first, second, batch } = await scenario()
      const [{ offer }] = await inbox(first.id)

      await useCases.advanceOfferQueue.execute({ now: minutesLater(30) })

      expect((await offersOf(batch.id)).map((o: { institutionId: string; status: string }) => [o.institutionId, o.status])).toEqual([
        [first.id, 'EXPIRED'],
        [second.id, 'PENDING'],
      ])

      now = minutesLater(31)
      const late = await respond(offer.id, 'accept', first.id)

      expect(late.statusCode).toBe(409)
    })

    it('só a instituição ofertada responde (403) e a oferta precisa existir (404)', async () => {
      const { first, second } = await scenario()
      const [{ offer }] = await inbox(first.id)

      const other = await respond(offer.id, 'accept', second.id)
      const missing = await respond('nao-existe', 'accept', first.id)
      const noBody = await app.inject({ method: 'PATCH', url: `/offers/${offer.id}/accept` })
      const unknownInstitution = await app.inject({ method: 'GET', url: '/institutions/nao-existe/offers' })

      expect(other.statusCode).toBe(403)
      expect(other.json().message).toBe('This offer was made to another institution.')
      expect(missing.statusCode).toBe(404)
      expect(noBody.statusCode).toBe(400)
      expect(unknownInstitution.statusCode).toBe(404)
    })

    it('aceita e retira: RESERVED e depois COLLECTED; retirar antes do aceite ou duas vezes dá 409', async () => {
      const { first, batch } = await scenario()
      const [{ offer }] = await inbox(first.id)

      expect((await respond(offer.id, 'pickup', first.id)).statusCode).toBe(409)

      const accepted = await respond(offer.id, 'accept', first.id)

      expect(accepted.json().offer.status).toBe('ACCEPTED')
      expect((await app.inject({ method: 'GET', url: `/batches/${batch.id}` })).json().batch.status).toBe('RESERVED')

      expect((await respond(offer.id, 'pickup', first.id)).statusCode).toBe(200)
      expect((await app.inject({ method: 'GET', url: '/batches?status=COLLECTED' })).json().batches).toHaveLength(1)
      expect((await respond(offer.id, 'pickup', first.id)).statusCode).toBe(409)
    })
  })

  describe('endereço de retirada', () => {
    const address = {
      street: 'Avenida Eduardo Ribeiro',
      number: '520',
      complement: 'loja 2',
      district: 'Centro',
      city: 'Manaus',
      state: 'AM',
      postalCode: '69005-040',
    }

    it('GET /geocoding/postal-code/:cep preenche rua, bairro, cidade e UF', async () => {
      const found = await app.inject({ method: 'GET', url: '/geocoding/postal-code/69005-040' })
      const missing = await app.inject({ method: 'GET', url: '/geocoding/postal-code/00000000' })
      const invalid = await app.inject({ method: 'GET', url: '/geocoding/postal-code/123' })
      const down = await app.inject({ method: 'GET', url: '/geocoding/postal-code/99999999' })

      expect(found.json().address).toMatchObject({ street: 'Avenida Eduardo Ribeiro', city: 'Manaus', state: 'AM' })
      expect(missing.statusCode).toBe(404)
      expect(invalid.statusCode).toBe(400)
      expect(down.statusCode).toBe(503)
    })

    it('GET /geocoding/search devolve endereços com coordenadas', async () => {
      const response = await app.inject({ method: 'GET', url: '/geocoding/search?q=Av.%20Eduardo%20Ribeiro%2C%20520' })
      const tooShort = await app.inject({ method: 'GET', url: '/geocoding/search?q=ab' })

      expect(response.json().results[0]).toMatchObject({ latitude: -3.1316, longitude: -60.0234 })
      expect(tooShort.json().results).toEqual([])
    })

    it('POST /batches guarda o endereço e o devolve formatado', async () => {
      const response = await post('/batches', { ...batchBody, address })

      expect(response.statusCode).toBe(201)
      expect(response.json().batch.address).toEqual({
        street: 'Avenida Eduardo Ribeiro',
        number: '520',
        complement: 'loja 2',
        district: 'Centro',
        city: 'Manaus',
        state: 'AM',
        postalCode: '69005-040',
        formatted: 'Avenida Eduardo Ribeiro, 520, loja 2 - Centro, Manaus/AM, 69005-040',
      })
    })

    it('POST /batches sem endereço continua funcionando (local marcado só no mapa)', async () => {
      const response = await post('/batches', batchBody)

      expect(response.statusCode).toBe(201)
      expect(response.json().batch.address).toBeNull()
    })

    it('POST /batches rejeita endereço incompleto com 400', async () => {
      const response = await post('/batches', { ...batchBody, address: { ...address, number: ' ' } })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('notificações', () => {
    async function offeredScenario() {
      const institution = makeInstitution({ ...farWithFridge, acceptedFoodTypes: [], name: 'ONG Teste', latitude: -3.11, validated: true })

      await institutionsRepository.create(institution)
      const batch = (await post('/batches', batchBody)).json().batch

      return { institution, batch }
    }

    const list = async (recipientId: string) =>
      (await app.inject({ method: 'GET', url: `/notifications?recipientId=${recipientId}` })).json()

    it('a instituição recebe a nova oferta no sininho, com contador de não lidas', async () => {
      const { institution, batch } = await offeredScenario()

      const body = await list(institution.id)

      expect(body.unreadCount).toBe(1)
      expect(body.notifications[0]).toMatchObject({
        type: 'OFFER_RECEIVED',
        title: 'Nova doação para você',
        batchId: batch.id,
        readAt: null,
      })
    })

    it('marca uma como lida; só o destinatário pode marcar', async () => {
      const { institution } = await offeredScenario()
      const [notification] = (await list(institution.id)).notifications

      const other = await app.inject({
        method: 'PATCH',
        url: `/notifications/${notification.id}/read`,
        payload: { recipientId: 'outra-pessoa' },
      })
      const own = await app.inject({
        method: 'PATCH',
        url: `/notifications/${notification.id}/read`,
        payload: { recipientId: institution.id },
      })

      expect(other.statusCode).toBe(403)
      expect(own.json().notification.readAt).toBe(NOW.toISOString())
      expect((await list(institution.id)).unreadCount).toBe(0)
    })

    it('marcar todas como lidas e aviso ao doador quando a instituição aceita', async () => {
      const { institution } = await offeredScenario()
      const [notification] = (await list(institution.id)).notifications

      await app.inject({
        method: 'PATCH',
        url: `/offers/${notification.offerId}/accept`,
        payload: { institutionId: institution.id },
      })

      const donor = await list('donor-1')

      expect(donor.notifications.map((n: { type: string }) => n.type)).toEqual(['OFFER_ACCEPTED'])
      expect(donor.notifications[0].message).toBe('ONG Teste aceitou sua doação de 18 kg de hortifruti e vai fazer a retirada.')

      const marked = await app.inject({ method: 'PATCH', url: '/notifications/read-all', payload: { recipientId: 'donor-1' } })

      expect(marked.json()).toEqual({ markedCount: 1 })
      expect((await list('donor-1')).unreadCount).toBe(0)
    })

    it('exige o destinatário', async () => {
      expect((await app.inject({ method: 'GET', url: '/notifications' })).statusCode).toBe(400)
    })
  })
})
