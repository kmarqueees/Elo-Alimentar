import type { Reservation } from '@/matching/types'

export interface CreateReservationData {
  batchId: string
  institutionId: string
  score: number
  expiresAt: Date
}

export interface ReservationsRepository {
  findById(id: string): Promise<Reservation | null>
  findManyByBatchId(batchId: string): Promise<Reservation[]>
  findManyPendingExpiredAt(now: Date): Promise<Reservation[]>
  create(data: CreateReservationData): Promise<Reservation>
  confirm(id: string, now: Date): Promise<Reservation>
  release(id: string, status: 'CANCELLED' | 'EXPIRED'): Promise<Reservation>
  markCollected(id: string): Promise<Reservation>
}
