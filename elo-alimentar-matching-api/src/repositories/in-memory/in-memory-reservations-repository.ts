import { randomUUID } from 'node:crypto'
import type { BatchStatus, Reservation } from '@/matching/types'
import { BatchNotAvailableError } from '@/use-cases/errors/batch-not-available-error'
import { ResourceNotFoundError } from '@/use-cases/errors/resource-not-found-error'
import type {
  CreateReservationData,
  ReservationsRepository,
} from '../reservations-repository'
import type { InMemoryFoodBatchesRepository } from './in-memory-food-batches-repository'

export class InMemoryReservationsRepository implements ReservationsRepository {
  public items: Reservation[] = []

  constructor(private batchesRepository: InMemoryFoodBatchesRepository) {}

  async findById(id: string) {
    return this.items.find((item) => item.id === id) ?? null
  }

  async findManyByBatchId(batchId: string) {
    return this.items.filter((item) => item.batchId === batchId)
  }

  async findManyPendingExpiredAt(now: Date) {
    return this.items.filter(
      (item) => item.status === 'PENDING' && item.expiresAt.getTime() <= now.getTime(),
    )
  }

  async create(data: CreateReservationData) {
    this.setBatchStatus(data.batchId, 'RESERVED', 'AVAILABLE')

    const reservation: Reservation = {
      id: randomUUID(),
      ...data,
      status: 'PENDING',
      createdAt: new Date(),
      confirmedAt: null,
    }

    this.items.push(reservation)

    return reservation
  }

  async confirm(id: string, now: Date) {
    const reservation = this.get(id)

    reservation.status = 'CONFIRMED'
    reservation.confirmedAt = now

    return reservation
  }

  async release(id: string, status: 'CANCELLED' | 'EXPIRED') {
    const reservation = this.get(id)

    reservation.status = status
    this.setBatchStatus(reservation.batchId, 'AVAILABLE')

    return reservation
  }

  async markCollected(id: string) {
    const reservation = this.get(id)

    this.setBatchStatus(reservation.batchId, 'COLLECTED')

    return reservation
  }

  private get(id: string) {
    const reservation = this.items.find((item) => item.id === id)

    if (!reservation) {
      throw new ResourceNotFoundError()
    }

    return reservation
  }

  private setBatchStatus(batchId: string, status: BatchStatus, onlyFrom?: BatchStatus) {
    const batch = this.batchesRepository.items.find((item) => item.id === batchId)

    if (!batch) {
      throw new ResourceNotFoundError()
    }

    if (onlyFrom && batch.status !== onlyFrom) {
      throw new BatchNotAvailableError()
    }

    batch.status = status
  }
}
