import type { ReservationsRepository } from '@/repositories/reservations-repository'
import type { Reservation } from '@/matching/types'
import { InvalidReservationStateError } from './errors/invalid-reservation-state-error'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface CompletePickupUseCaseRequest {
  reservationId: string
}

export class CompletePickupUseCase {
  constructor(private reservationsRepository: ReservationsRepository) {}

  async execute({
    reservationId,
  }: CompletePickupUseCaseRequest): Promise<{ reservation: Reservation }> {
    const reservation = await this.reservationsRepository.findById(reservationId)

    if (!reservation) {
      throw new ResourceNotFoundError()
    }

    if (reservation.status !== 'CONFIRMED') {
      throw new InvalidReservationStateError()
    }

    return { reservation: await this.reservationsRepository.markCollected(reservationId) }
  }
}
