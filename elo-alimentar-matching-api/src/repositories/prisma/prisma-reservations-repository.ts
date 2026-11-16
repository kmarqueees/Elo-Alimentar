import type { PrismaClient, Reservation as PrismaReservation } from '@prisma/client'
import type { Reservation } from '@/matching/types'
import { BatchNotAvailableError } from '@/use-cases/errors/batch-not-available-error'
import { ResourceNotFoundError } from '@/use-cases/errors/resource-not-found-error'
import type {
  CreateReservationData,
  ReservationsRepository,
} from '../reservations-repository'

function toDomain(row: PrismaReservation): Reservation {
  return {
    id: row.id,
    batchId: row.batch_id,
    institutionId: row.institution_id,
    score: row.score,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    confirmedAt: row.confirmed_at,
  }
}

export class PrismaReservationsRepository implements ReservationsRepository {
  constructor(private client: PrismaClient) {}

  async findById(id: string) {
    const row = await this.client.reservation.findUnique({ where: { id } })

    return row ? toDomain(row) : null
  }

  async findManyByBatchId(batchId: string) {
    const rows = await this.client.reservation.findMany({
      where: { batch_id: batchId },
      orderBy: { created_at: 'asc' },
    })

    return rows.map(toDomain)
  }

  async findManyPendingExpiredAt(now: Date) {
    const rows = await this.client.reservation.findMany({
      where: { status: 'PENDING', expires_at: { lte: now } },
    })

    return rows.map(toDomain)
  }

  async create(data: CreateReservationData) {
    return this.client.$transaction(async (tx) => {
      const { count } = await tx.foodBatch.updateMany({
        where: { id: data.batchId, status: 'AVAILABLE' },
        data: { status: 'RESERVED' },
      })

      if (count === 0) {
        throw new BatchNotAvailableError()
      }

      const row = await tx.reservation.create({
        data: {
          batch_id: data.batchId,
          institution_id: data.institutionId,
          score: data.score,
          expires_at: data.expiresAt,
        },
      })

      return toDomain(row)
    })
  }

  async confirm(id: string, now: Date) {
    const row = await this.client.reservation.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmed_at: now },
    })

    return toDomain(row)
  }

  async release(id: string, status: 'CANCELLED' | 'EXPIRED') {
    return this.client.$transaction(async (tx) => {
      const row = await tx.reservation.update({ where: { id }, data: { status } })

      await tx.foodBatch.update({
        where: { id: row.batch_id },
        data: { status: 'AVAILABLE' },
      })

      return toDomain(row)
    })
  }

  async markCollected(id: string) {
    const reservation = await this.client.reservation.findUnique({ where: { id } })

    if (!reservation) {
      throw new ResourceNotFoundError()
    }

    await this.client.foodBatch.update({
      where: { id: reservation.batch_id },
      data: { status: 'COLLECTED' },
    })

    return toDomain(reservation)
  }
}
