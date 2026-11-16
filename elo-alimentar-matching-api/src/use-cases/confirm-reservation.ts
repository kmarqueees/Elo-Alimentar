import type { ReservationsRepository } from '@/repositories/reservations-repository'
import type { Reservation } from '@/matching/types'
import { InvalidReservationStateError } from './errors/invalid-reservation-state-error'
import { ReservationExpiredError } from './errors/reservation-expired-error'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface ConfirmReservationUseCaseRequest {
  reservationId: string
  now?: Date
}

export class ConfirmReservationUseCase {
  constructor(private reservationsRepository: ReservationsRepository) {}

  async execute({
    reservationId,
    now = new Date(),
  }: ConfirmReservationUseCaseRequest): Promise<{ reservation: Reservation }> {
    const reservation = await this.reservationsRepository.findById(reservationId)

    if (!reservation) {
      throw new ResourceNotFoundError()
    }

    if (reservation.status !== 'PENDING') {
      throw new InvalidReservationStateError()
    }

    if (now.getTime() >= reservation.expiresAt.getTime()) {
      throw new ReservationExpiredError()
    }

    return { reservation: await this.reservationsRepository.confirm(reservationId, now) }
  }
}
