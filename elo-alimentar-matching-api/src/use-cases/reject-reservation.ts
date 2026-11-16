import type { ReservationsRepository } from '@/repositories/reservations-repository'
import type { Reservation } from '@/matching/types'
import { InvalidReservationStateError } from './errors/invalid-reservation-state-error'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface RejectReservationUseCaseRequest {
  reservationId: string
}

export class RejectReservationUseCase {
  constructor(private reservationsRepository: ReservationsRepository) {}

  async execute({
    reservationId,
  }: RejectReservationUseCaseRequest): Promise<{ reservation: Reservation }> {
    const reservation = await this.reservationsRepository.findById(reservationId)

    if (!reservation) {
      throw new ResourceNotFoundError()
    }

    if (reservation.status !== 'PENDING') {
      throw new InvalidReservationStateError()
    }

    return {
      reservation: await this.reservationsRepository.release(reservationId, 'CANCELLED'),
    }
  }
}
