import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryFoodBatchesRepository } from '@/repositories/in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '@/repositories/in-memory/in-memory-institutions-repository'
import { InMemoryReservationsRepository } from '@/repositories/in-memory/in-memory-reservations-repository'
import { MultiCriteriaStrategy } from '@/matching/strategies/multi-criteria-strategy'
import { MatchBatchUseCase } from './match-batch'
import { ReserveBatchUseCase } from './reserve-batch'
import { ConfirmReservationUseCase } from './confirm-reservation'
import { RejectReservationUseCase } from './reject-reservation'
import { CompletePickupUseCase } from './complete-pickup'
import { ExpireReservationsUseCase } from './expire-reservations'
import { BatchNotAvailableError } from './errors/batch-not-available-error'
import { InstitutionNotEligibleError } from './errors/institution-not-eligible-error'
import { InvalidReservationStateError } from './errors/invalid-reservation-state-error'
import { ReservationExpiredError } from './errors/reservation-expired-error'

let batches: InMemoryFoodBatchesRepository
let institutions: InMemoryInstitutionsRepository
let reservations: InMemoryReservationsRepository
let match: MatchBatchUseCase
let reserve: ReserveBatchUseCase

const now = new Date('2026-10-16T12:00:00Z')
const minutesLater = (m: number) => new Date(now.getTime() + m * 60_000)
const KM = 0.009

function makeInstitution(id: string, kmAway: number, overrides = {}) {
  return institutions.create({
    id,
    name: id,
    latitude: -3.1 + kmAway * KM,
    longitude: -60.0,
    hasRefrigeration: true,
    availableCapacityKg: 100,
    acceptedFoodTypes: [],
    validated: true,
    ...overrides,
  })
}

async function makeBatch() {
  return batches.create({
    donorId: 'donor-1',
    foodType: 'HORTIFRUTI',
    quantityKg: 18,
    expiresAt: new Date('2026-10-16T14:00:00Z'),
    storageCondition: 'REFRIGERATED',
    latitude: -3.1,
    longitude: -60.0,
  })
}

describe('Reservas: solicitar, confirmar, recusar, expirar e retirar', () => {
  beforeEach(() => {
    batches = new InMemoryFoodBatchesRepository()
    institutions = new InMemoryInstitutionsRepository()
    reservations = new InMemoryReservationsRepository(batches)
    match = new MatchBatchUseCase(batches, institutions, new MultiCriteriaStrategy(), reservations)
    reserve = new ReserveBatchUseCase(match, reservations, 30)
  })

  it('reserva o lote para uma instituição do ranking, com prazo de 30 min', async () => {
    const batch = await makeBatch()
    await makeInstitution('a', 1)

    const { reservation } = await reserve.execute({ batchId: batch.id, institutionId: 'a', now })

    expect(reservation.status).toBe('PENDING')
    expect(reservation.expiresAt).toEqual(minutesLater(30))
    expect(batch.status).toBe('RESERVED')
  })

  it('não reserva para quem está fora do ranking, como instituição sem refrigeração (RN01)', async () => {
    const batch = await makeBatch()
    await makeInstitution('sem-geladeira', 1, { hasRefrigeration: false })

    await expect(
      reserve.execute({ batchId: batch.id, institutionId: 'sem-geladeira', now }),
    ).rejects.toBeInstanceOf(InstitutionNotEligibleError)
  })

  it('só uma reserva por lote (RN06)', async () => {
    const batch = await makeBatch()
    await makeInstitution('a', 1)
    await makeInstitution('b', 2)
    await reserve.execute({ batchId: batch.id, institutionId: 'a', now })

    await expect(
      reserve.execute({ batchId: batch.id, institutionId: 'b', now }),
    ).rejects.toBeInstanceOf(BatchNotAvailableError)
  })

  it('recusa devolve o lote ao ranking sem a instituição recusada (RN08)', async () => {
    const batch = await makeBatch()
    await makeInstitution('a', 1)
    await makeInstitution('b', 2)
    const { reservation } = await reserve.execute({ batchId: batch.id, institutionId: 'a', now })

    await new RejectReservationUseCase(reservations).execute({ reservationId: reservation.id })

    const { ranking } = await match.execute({ batchId: batch.id, now })

    expect(batch.status).toBe('AVAILABLE')
    expect(ranking.map((r) => r.institution.id)).toEqual(['b'])
  })

  it('reserva não confirmada expira e o lote é reofertado à próxima (RN08)', async () => {
    const batch = await makeBatch()
    await makeInstitution('a', 1)
    await makeInstitution('b', 2)
    await reserve.execute({ batchId: batch.id, institutionId: 'a', now })
    const sweeper = new ExpireReservationsUseCase(reservations)

    expect((await sweeper.execute({ now: minutesLater(10) })).expiredCount).toBe(0)
    expect((await sweeper.execute({ now: minutesLater(31) })).expiredCount).toBe(1)

    const { ranking } = await match.execute({ batchId: batch.id, now: minutesLater(31) })

    expect(batch.status).toBe('AVAILABLE')
    expect(ranking.map((r) => r.institution.id)).toEqual(['b'])
  })

  it('não confirma depois do prazo', async () => {
    const batch = await makeBatch()
    await makeInstitution('a', 1)
    const { reservation } = await reserve.execute({ batchId: batch.id, institutionId: 'a', now })

    await expect(
      new ConfirmReservationUseCase(reservations).execute({
        reservationId: reservation.id,
        now: minutesLater(31),
      }),
    ).rejects.toBeInstanceOf(ReservationExpiredError)
  })

  it('confirmar e retirar leva o lote a COLLECTED; retirar sem confirmar é bloqueado', async () => {
    const batch = await makeBatch()
    await makeInstitution('a', 1)
    const { reservation } = await reserve.execute({ batchId: batch.id, institutionId: 'a', now })
    const pickup = new CompletePickupUseCase(reservations)

    await expect(pickup.execute({ reservationId: reservation.id })).rejects.toBeInstanceOf(
      InvalidReservationStateError,
    )

    await new ConfirmReservationUseCase(reservations).execute({
      reservationId: reservation.id,
      now: minutesLater(5),
    })
    await pickup.execute({ reservationId: reservation.id })

    expect(batch.status).toBe('COLLECTED')
  })
})
