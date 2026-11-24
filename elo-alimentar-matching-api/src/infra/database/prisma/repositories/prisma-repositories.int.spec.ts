import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { CompareStrategiesUseCase } from '@/application/evaluation/compare-strategies'
import { MatchBatchUseCase } from '@/application/use-cases/matching/match-batch'
import { BatchNotAvailableError } from '@/domain/food-batch/errors/batch-not-available-error'
import { EligibleInstitutionsRanker } from '@/domain/matching/eligible-institutions-ranker'
import { DistanceOnlyStrategy } from '@/domain/matching/strategies/distance-only-strategy'
import { MultiCriteriaStrategy } from '@/domain/matching/strategies/multi-criteria-strategy'
import { InMemoryFoodBatchesRepository } from '@/infra/database/in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '@/infra/database/in-memory/in-memory-institutions-repository'
import {
  SCENARIO_NOW,
  batchFromScenario,
  generateScenario,
  institutionFromScenario,
} from '@/simulation/scenario'
import { makeFoodBatch } from '@/test/factories/make-food-batch'
import { makeInstitution } from '@/test/factories/make-institution'
import { PrismaDonorsRepository } from './prisma-donors-repository'
import { PrismaFoodBatchesRepository } from './prisma-food-batches-repository'
import { PrismaInstitutionsRepository } from './prisma-institutions-repository'

const testUrl = process.env.TEST_DATABASE_URL

if (!testUrl) {
  throw new Error(
    'Defina TEST_DATABASE_URL no .env (veja .env.example). O teste de integração apaga os dados desse banco.',
  )
}

const client = new PrismaClient({ datasourceUrl: testUrl })
const batchesRepository = new PrismaFoodBatchesRepository(client)
const institutionsRepository = new PrismaInstitutionsRepository(client)
const donorsRepository = new PrismaDonorsRepository(client)

async function createDonor(label = 'donor') {
  return client.user.create({
    data: {
      name: label,
      email: `${label}-${Math.random().toString(36).slice(2)}@test.dev`,
      password_hash: 'x',
      role: 'DONOR',
    },
  })
}

describe('Repositórios Prisma (integração)', () => {
  beforeAll(async () => {
    await client.$connect()
  })

  beforeEach(async () => {
    await client.offer.deleteMany()
    await client.foodBatch.deleteMany()
    await client.institution.deleteMany()
    await client.user.deleteMany()
  })

  afterAll(async () => {
    await client.$disconnect()
  })

  it('persiste e recupera um lote com os mesmos valores', async () => {
    const donor = await createDonor()
    const expiresAt = new Date('2026-10-16T18:00:00Z')

    const created = makeFoodBatch({
      donorId: donor.id,
      foodType: 'HORTIFRUTI',
      quantityKg: 18.5,
      expiresAt,
      storageCondition: 'REFRIGERATED',
      latitude: -3.1019,
      longitude: -60.025,
    })
    await batchesRepository.create(created)

    const found = await batchesRepository.findById(created.id)

    expect(found).toMatchObject({
      donorId: donor.id,
      foodType: 'HORTIFRUTI',
      quantityKg: 18.5,
      storageCondition: 'REFRIGERATED',
      latitude: -3.1019,
      longitude: -60.025,
      status: 'AVAILABLE',
    })
    expect(found?.expiresAt.getTime()).toEqual(expiresAt.getTime())
  })

  it('devolve null quando o lote não existe', async () => {
    expect(await batchesRepository.findById('inexistente')).toBeNull()
  })

  it('informa se o doador existe', async () => {
    const donor = await createDonor()

    expect(await donorsRepository.exists(donor.id)).toBe(true)
    expect(await donorsRepository.exists('inexistente')).toBe(false)
  })

  it('lista só os lotes disponíveis', async () => {
    const donor = await createDonor()
    const base = {
      donorId: donor.id,
      foodType: 'PANIFICADOS' as const,
      quantityKg: 5,
      expiresAt: new Date('2026-10-17T12:00:00Z'),
      storageCondition: 'DRY' as const,
      latitude: -3.1,
      longitude: -60,
    }

    await batchesRepository.create(makeFoodBatch(base))
    await batchesRepository.create(makeFoodBatch({ ...base, status: 'RESERVED' }))

    expect(await batchesRepository.findMany('AVAILABLE')).toHaveLength(1)
  })

  it('guarda a lista de tipos aceitos e só devolve instituições validadas (RN03)', async () => {
    await institutionsRepository.create(
      makeInstitution({
        name: 'Validada',
        latitude: -3.1,
        longitude: -60,
        hasRefrigeration: true,
        availableCapacityKg: 80,
        acceptedFoodTypes: ['HORTIFRUTI', 'LATICINIOS'],
        validated: true,
      }),
    )
    const pending = makeInstitution({
      name: 'Pendente',
      latitude: -3.1,
      longitude: -60,
      hasRefrigeration: false,
      availableCapacityKg: 10,
      acceptedFoodTypes: [],
      validated: false,
    })
    await institutionsRepository.create(pending)

    const validated = await institutionsRepository.findManyValidated()

    expect(validated).toHaveLength(1)
    expect(validated[0]).toMatchObject({
      name: 'Validada',
      hasRefrigeration: true,
      acceptedFoodTypes: ['HORTIFRUTI', 'LATICINIOS'],
    })

    pending.validate()
    await institutionsRepository.save(pending)

    expect(await institutionsRepository.findManyValidated()).toHaveLength(2)
  })

  it('o MatchBatch funciona lendo do banco (RN01 aplicada)', async () => {
    const donor = await createDonor()
    const KM = 0.009

    const batch = makeFoodBatch({
      donorId: donor.id,
      foodType: 'HORTIFRUTI',
      quantityKg: 18,
      expiresAt: new Date('2026-10-16T14:00:00Z'),
      storageCondition: 'REFRIGERATED',
      latitude: -3.1,
      longitude: -60,
    })
    await batchesRepository.create(batch)

    await institutionsRepository.create(
      makeInstitution({
        name: 'perto-sem-geladeira',
        latitude: -3.1 + 1 * KM,
        longitude: -60,
        hasRefrigeration: false,
        availableCapacityKg: 100,
        acceptedFoodTypes: [],
        validated: true,
      }),
    )
    await institutionsRepository.create(
      makeInstitution({
        name: 'longe-com-geladeira',
        latitude: -3.1 + 4 * KM,
        longitude: -60,
        hasRefrigeration: true,
        availableCapacityKg: 100,
        acceptedFoodTypes: [],
        validated: true,
      }),
    )

    const sut = new MatchBatchUseCase(
      batchesRepository,
      institutionsRepository,
      new EligibleInstitutionsRanker(new MultiCriteriaStrategy()),
    )

    const { ranking } = await sut.execute({
      batchId: batch.id,
      now: new Date('2026-10-16T12:00:00Z'),
    })

    expect(ranking.map((r) => r.institution.name)).toEqual(['longe-com-geladeira'])
  })

  it('oferece o lote no banco (RN06), e a oferta vencida devolve o lote à fila (RN08)', async () => {
    const donor = await createDonor()
    const now = new Date('2026-10-16T12:00:00Z')
    const batch = makeFoodBatch({
      donorId: donor.id,
      foodType: 'HORTIFRUTI',
      quantityKg: 10,
      expiresAt: new Date('2026-10-16T18:00:00Z'),
      storageCondition: 'REFRIGERATED',
      latitude: -3.1,
      longitude: -60,
    })
    const institution = makeInstitution({ name: 'Instituição', latitude: -3.1, longitude: -60 })

    await batchesRepository.create(batch)
    await institutionsRepository.create(institution)

    const loaded = (await batchesRepository.findById(batch.id))!
    const offer = loaded.offerTo({
      institutionId: institution.id,
      score: 0.9,
      now,
      timeoutMinutes: 30,
    })
    await batchesRepository.save(loaded)

    expect((await batchesRepository.findById(batch.id))?.status).toBe('OFFERED')
    expect((await batchesRepository.findByOfferId(offer.id))?.id).toBe(batch.id)
    expect((await batchesRepository.findManyOfferedTo(institution.id)).map((b) => b.id)).toEqual([batch.id])

    const queue = await batchesRepository.findManyInOfferQueue()

    expect(queue.map((item) => item.id)).toEqual([batch.id])

    queue[0]!.expireOverdueOffers(new Date('2026-10-16T13:00:00Z'))
    await batchesRepository.save(queue[0]!)

    const reloaded = (await batchesRepository.findById(batch.id))!

    expect(reloaded.status).toBe('AVAILABLE')
    expect(reloaded.offers.map((item) => item.status)).toEqual(['EXPIRED'])
  })

  it('aceite e expiração ao mesmo tempo: só o primeiro a gravar vale', async () => {
    const donor = await createDonor()
    const now = new Date('2026-10-16T12:00:00Z')
    const batch = makeFoodBatch({ donorId: donor.id })
    const institution = makeInstitution({ name: 'A' })

    await institutionsRepository.create(institution)
    const offer = batch.offerTo({ institutionId: institution.id, score: 1, now, timeoutMinutes: 30 })
    await batchesRepository.create(batch)

    // A instituição e a varredura leem o lote ainda OFFERED...
    const byInstitution = (await batchesRepository.findById(batch.id))!
    const bySweep = (await batchesRepository.findById(batch.id))!

    byInstitution.acceptOffer(offer.id, institution.id, new Date('2026-10-16T12:29:00Z'))
    bySweep.expireOverdueOffers(new Date('2026-10-16T12:30:00Z'))

    // ...mas só uma gravação passa: o aceite não é sobrescrito pela expiração.
    await batchesRepository.save(byInstitution)
    await expect(batchesRepository.save(bySweep)).rejects.toBeInstanceOf(BatchNotAvailableError)

    const reloaded = (await batchesRepository.findById(batch.id))!

    expect(reloaded.status).toBe('RESERVED')
    expect(reloaded.offers.map((item) => item.status)).toEqual(['ACCEPTED'])
  })

  it('duas ofertas simultâneas do mesmo lote: só a primeira é gravada (RN06)', async () => {
    const donor = await createDonor()
    const now = new Date('2026-10-16T12:00:00Z')
    const batch = makeFoodBatch({ donorId: donor.id })
    const a = makeInstitution({ name: 'A' })
    const b = makeInstitution({ name: 'B' })

    await batchesRepository.create(batch)
    await institutionsRepository.create(a)
    await institutionsRepository.create(b)

    const first = (await batchesRepository.findById(batch.id))!
    const second = (await batchesRepository.findById(batch.id))!

    first.offerTo({ institutionId: a.id, score: 1, now, timeoutMinutes: 30 })
    second.offerTo({ institutionId: b.id, score: 1, now, timeoutMinutes: 30 })

    await batchesRepository.save(first)
    await expect(batchesRepository.save(second)).rejects.toBeInstanceOf(
      BatchNotAvailableError,
    )

    const reloaded = (await batchesRepository.findById(batch.id))!

    expect(reloaded.offers.map((item) => item.institutionId)).toEqual([a.id])
  })

  it('o cenário da simulação dá o MESMO resultado no banco e em memória', async () => {
    const { institutions, batches } = generateScenario(42)
    const donor = await createDonor()

    const memBatches = new InMemoryFoodBatchesRepository()
    const memInstitutions = new InMemoryInstitutionsRepository()

    for (const institution of institutions) {
      await institutionsRepository.create(institutionFromScenario(institution))
      await memInstitutions.create(institutionFromScenario(institution))
    }

    for (const batch of batches) {
      await batchesRepository.create(batchFromScenario({ ...batch, donorId: donor.id }))
      await memBatches.create(batchFromScenario(batch))
    }

    const strategies = () => [new DistanceOnlyStrategy(), new MultiCriteriaStrategy()]

    const fromDb = await new CompareStrategiesUseCase(
      batchesRepository,
      institutionsRepository,
      strategies(),
    ).execute({ now: SCENARIO_NOW })

    const fromMemory = await new CompareStrategiesUseCase(
      memBatches,
      memInstitutions,
      strategies(),
    ).execute({ now: SCENARIO_NOW })

    expect(fromDb.summaries).toEqual(fromMemory.summaries)
    expect(fromDb.timeReductionPercent).toBeCloseTo(
      fromMemory.timeReductionPercent!,
      6,
    )
  })
})
