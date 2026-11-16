import 'dotenv/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaFoodBatchesRepository } from './prisma-food-batches-repository'
import { PrismaInstitutionsRepository } from './prisma-institutions-repository'
import { PrismaReservationsRepository } from './prisma-reservations-repository'
import { BatchNotAvailableError } from '@/use-cases/errors/batch-not-available-error'
import { InMemoryFoodBatchesRepository } from '../in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '../in-memory/in-memory-institutions-repository'
import { MatchBatchUseCase } from '@/use-cases/match-batch'
import { CompareStrategiesUseCase } from '@/use-cases/compare-strategies'
import { MultiCriteriaStrategy } from '@/matching/strategies/multi-criteria-strategy'
import { DistanceOnlyStrategy } from '@/matching/strategies/distance-only-strategy'
import { SCENARIO_NOW, generateScenario } from '@/simulation/scenario'

const testUrl = process.env.TEST_DATABASE_URL

if (!testUrl) {
  throw new Error(
    'Defina TEST_DATABASE_URL no .env (veja .env.example). O teste de integração apaga os dados desse banco.',
  )
}

const client = new PrismaClient({ datasourceUrl: testUrl })
const batchesRepository = new PrismaFoodBatchesRepository(client)
const institutionsRepository = new PrismaInstitutionsRepository(client)
const reservationsRepository = new PrismaReservationsRepository(client)

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
    await client.reservation.deleteMany()
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

    const created = await batchesRepository.create({
      donorId: donor.id,
      foodType: 'HORTIFRUTI',
      quantityKg: 18.5,
      expiresAt,
      storageCondition: 'REFRIGERATED',
      latitude: -3.1019,
      longitude: -60.025,
    })

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

    await batchesRepository.create(base)
    const reserved = await batchesRepository.create(base)
    await client.foodBatch.update({
      where: { id: reserved.id },
      data: { status: 'RESERVED' },
    })

    expect(await batchesRepository.findManyAvailable()).toHaveLength(1)
  })

  it('guarda a lista de tipos aceitos e só devolve instituições validadas (RN03)', async () => {
    await institutionsRepository.create({
      name: 'Validada',
      latitude: -3.1,
      longitude: -60,
      hasRefrigeration: true,
      availableCapacityKg: 80,
      acceptedFoodTypes: ['HORTIFRUTI', 'LATICINIOS'],
      validated: true,
    })
    await institutionsRepository.create({
      name: 'Pendente',
      latitude: -3.1,
      longitude: -60,
      hasRefrigeration: false,
      availableCapacityKg: 10,
      acceptedFoodTypes: [],
      validated: false,
    })

    const validated = await institutionsRepository.findManyValidated()

    expect(validated).toHaveLength(1)
    expect(validated[0]).toMatchObject({
      name: 'Validada',
      hasRefrigeration: true,
      acceptedFoodTypes: ['HORTIFRUTI', 'LATICINIOS'],
    })
  })

  it('o MatchBatch funciona lendo do banco (RN01 aplicada)', async () => {
    const donor = await createDonor()
    const KM = 0.009

    const batch = await batchesRepository.create({
      donorId: donor.id,
      foodType: 'HORTIFRUTI',
      quantityKg: 18,
      expiresAt: new Date('2026-10-16T14:00:00Z'),
      storageCondition: 'REFRIGERATED',
      latitude: -3.1,
      longitude: -60,
    })

    await institutionsRepository.create({
      name: 'perto-sem-geladeira',
      latitude: -3.1 + 1 * KM,
      longitude: -60,
      hasRefrigeration: false,
      availableCapacityKg: 100,
      acceptedFoodTypes: [],
      validated: true,
    })
    await institutionsRepository.create({
      name: 'longe-com-geladeira',
      latitude: -3.1 + 4 * KM,
      longitude: -60,
      hasRefrigeration: true,
      availableCapacityKg: 100,
      acceptedFoodTypes: [],
      validated: true,
    })

    const sut = new MatchBatchUseCase(
      batchesRepository,
      institutionsRepository,
      new MultiCriteriaStrategy(),
      reservationsRepository,
    )

    const { ranking } = await sut.execute({
      batchId: batch.id,
      now: new Date('2026-10-16T12:00:00Z'),
    })

    expect(ranking.map((r) => r.institution.name)).toEqual(['longe-com-geladeira'])
  })

  it('reserva o lote no banco (RN06), e liberar devolve o lote para AVAILABLE (RN08)', async () => {
    const donor = await createDonor()
    const batch = await batchesRepository.create({
      donorId: donor.id,
      foodType: 'HORTIFRUTI',
      quantityKg: 10,
      expiresAt: new Date('2026-10-16T18:00:00Z'),
      storageCondition: 'REFRIGERATED',
      latitude: -3.1,
      longitude: -60,
    })
    const institution = await institutionsRepository.create({
      name: 'Instituição',
      latitude: -3.1,
      longitude: -60,
      hasRefrigeration: true,
      availableCapacityKg: 100,
      acceptedFoodTypes: [],
      validated: true,
    })
    const data = {
      batchId: batch.id,
      institutionId: institution.id,
      score: 0.9,
      expiresAt: new Date('2026-10-16T12:30:00Z'),
    }

    const reservation = await reservationsRepository.create(data)

    expect((await batchesRepository.findById(batch.id))?.status).toBe('RESERVED')
    await expect(reservationsRepository.create(data)).rejects.toBeInstanceOf(
      BatchNotAvailableError,
    )

    const pending = await reservationsRepository.findManyPendingExpiredAt(
      new Date('2026-10-16T13:00:00Z'),
    )

    expect(pending.map((r) => r.id)).toEqual([reservation.id])

    await reservationsRepository.release(reservation.id, 'EXPIRED')

    expect((await batchesRepository.findById(batch.id))?.status).toBe('AVAILABLE')
  })

  it('o cenário da simulação dá o MESMO resultado no banco e em memória', async () => {
    const { institutions, batches } = generateScenario(42)
    const donor = await createDonor()

    const memBatches = new InMemoryFoodBatchesRepository()
    const memInstitutions = new InMemoryInstitutionsRepository()

    for (const institution of institutions) {
      await institutionsRepository.create(institution)
      await memInstitutions.create(institution)
    }

    for (const batch of batches) {
      await batchesRepository.create({ ...batch, donorId: donor.id })
      await memBatches.create(batch)
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
