import type { ReservationsRepository } from '@/repositories/reservations-repository'

interface ExpireReservationsUseCaseRequest {
  now?: Date
}

export class ExpireReservationsUseCase {
  constructor(private reservationsRepository: ReservationsRepository) {}

  async execute({
    now = new Date(),
  }: ExpireReservationsUseCaseRequest = {}): Promise<{ expiredCount: number }> {
    const overdue = await this.reservationsRepository.findManyPendingExpiredAt(now)

    for (const reservation of overdue) {
      await this.reservationsRepository.release(reservation.id, 'EXPIRED')
    }

    return { expiredCount: overdue.length }
  }
}
