import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app'
import { InMemoryFoodBatchesRepository } from '@/repositories/in-memory/in-memory-food-batches-repository'
import { InMemoryReservationsRepository } from '@/repositories/in-memory/in-memory-reservations-repository'
import { InMemoryInstitutionsRepository } from '@/repositories/in-memory/in-memory-institutions-repository'
import { SCENARIO_NOW, generateScenario } from '@/simulation/scenario'

let app: FastifyInstance
let batchesRepository: InMemoryFoodBatchesRepository
let institutionsRepository: InMemoryInstitutionsRepository
let reservationsRepository: InMemoryReservationsRepository

const NOW = new Date('2026-10-16T12:00:00Z')

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
  availableCapacityKg: 100,
}

const farWithFridge = {
  name: 'ONG longe, com geladeira',
  latitude: -3.083,
  longitude: -60.0217,
  hasRefrigeration: true,
  availableCapacityKg: 100,
}

async function post(url: string, payload: unknown) {
  return app.inject({ method: 'POST', url, payload: payload as object })
}

describe('API HTTP', () => {
  beforeEach(async () => {
    batchesRepository = new InMemoryFoodBatchesRepository()
    institutionsRepository = new InMemoryInstitutionsRepository()
    reservationsRepository = new InMemoryReservationsRepository(batchesRepository)
    app = buildApp({
      batchesRepository,
      institutionsRepository,
      reservationsRepository,
      clock: () => NOW,
    })
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
        availableCapacityKg: 0,
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

    it('devolve 404 para lote inexistente e 409 para lote já reservado', async () => {
      const { batch } = await seedStory()

      const missing = await app.inject({
        method: 'GET',
        url: '/batches/nao-existe/matches',
      })

      const stored = await batchesRepository.findById(batch.id)
      stored!.status = 'RESERVED'

      const reserved = await app.inject({
        method: 'GET',
        url: `/batches/${batch.id}/matches`,
      })

      expect(missing.statusCode).toEqual(404)
      expect(reserved.statusCode).toEqual(409)
    })
  })

  describe('comparação', () => {
    it('GET /comparison reproduz os números da simulação (semente 42)', async () => {
      const { institutions, batches } = generateScenario(42)

      for (const institution of institutions) {
        await institutionsRepository.create(institution)
      }

      for (const batch of batches) {
        await batchesRepository.create(batch)
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
      expect(body.timeReductionPercent).toEqual(65.3)
    })

    it('GET /comparison funciona sem dados', async () => {
      const response = await app.inject({ method: 'GET', url: '/comparison' })

      expect(response.statusCode).toEqual(200)
      expect(response.json().timeReductionPercent).toBeNull()
    })
  })

  describe('reserva, recusa e reoferta (RF09, RN06, RN08)', () => {
    async function scenario() {
      const first = (await institutionsRepository.create({ ...farWithFridge, acceptedFoodTypes: [], name: 'Primeira', latitude: -3.11, validated: true }))
      const second = (await institutionsRepository.create({ ...farWithFridge, acceptedFoodTypes: [], name: 'Segunda', validated: true }))
      const noFridge = (await institutionsRepository.create({ ...nearNoFridge, acceptedFoodTypes: [], validated: true }))
      const batch = (await post('/batches', batchBody)).json().batch

      return { first, second, noFridge, batch }
    }

    const reserve = (batchId: string, institutionId: string) =>
      post(`/batches/${batchId}/reservations`, { institutionId })

    it('reserva o lote e muda o status para RESERVED; segunda reserva dá 409 (RN06)', async () => {
      const { first, second, batch } = await scenario()

      const created = await reserve(batch.id, first.id)

      expect(created.statusCode).toBe(201)
      expect(created.json().reservation.status).toBe('PENDING')

      const batches = (await app.inject({ method: 'GET', url: '/batches?status=RESERVED' })).json()

      expect(batches.batches).toHaveLength(1)

      const again = await reserve(batch.id, second.id)

      expect(again.statusCode).toBe(409)
    })

    it('recusa reserva de instituição fora do ranking (sem geladeira) com 409', async () => {
      const { noFridge, batch } = await scenario()

      const response = await reserve(batch.id, noFridge.id)

      expect(response.statusCode).toBe(409)
    })

    it('doador recusa: lote volta a ficar disponível e a próxima colocada passa a ser a sugestão (RN08)', async () => {
      const { first, second, batch } = await scenario()
      const { reservation } = (await reserve(batch.id, first.id)).json()

      const rejected = await app.inject({ method: 'PATCH', url: `/reservations/${reservation.id}/reject` })

      expect(rejected.statusCode).toBe(200)
      expect(rejected.json().reservation.status).toBe('CANCELLED')

      const matches = (await app.inject({ method: 'GET', url: `/batches/${batch.id}/matches` })).json()

      expect(matches.ranking.map((r: { institution: { id: string } }) => r.institution.id)).toEqual([second.id])

      const history = (await app.inject({ method: 'GET', url: `/batches/${batch.id}/reservations` })).json()

      expect(history.reservations).toHaveLength(1)
    })

    it('doador aceita e a instituição retira: lote passa para COLLECTED', async () => {
      const { first, batch } = await scenario()
      const { reservation } = (await reserve(batch.id, first.id)).json()

      const confirmed = await app.inject({ method: 'PATCH', url: `/reservations/${reservation.id}/confirm` })

      expect(confirmed.json().reservation.status).toBe('CONFIRMED')

      const pickedUp = await app.inject({ method: 'PATCH', url: `/reservations/${reservation.id}/pickup` })

      expect(pickedUp.statusCode).toBe(200)

      const collected = (await app.inject({ method: 'GET', url: '/batches?status=COLLECTED' })).json()

      expect(collected.batches).toHaveLength(1)
    })

    it('não dá para retirar sem o doador confirmar (409) nem confirmar reserva inexistente (404)', async () => {
      const { first, batch } = await scenario()
      const { reservation } = (await reserve(batch.id, first.id)).json()

      const early = await app.inject({ method: 'PATCH', url: `/reservations/${reservation.id}/pickup` })
      const missing = await app.inject({ method: 'PATCH', url: '/reservations/nope/confirm' })

      expect(early.statusCode).toBe(409)
      expect(missing.statusCode).toBe(404)
    })
  })
})
