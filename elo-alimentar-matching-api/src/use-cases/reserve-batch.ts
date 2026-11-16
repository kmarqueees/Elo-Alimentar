import type { ReservationsRepository } from '@/repositories/reservations-repository'
import type { Reservation } from '@/matching/types'
import type { MatchBatchUseCase } from './match-batch'
import { InstitutionNotEligibleError } from './errors/institution-not-eligible-error'

interface ReserveBatchUseCaseRequest {
  batchId: string
  institutionId: string
  now?: Date
}

interface ReserveBatchUseCaseResponse {
  reservation: Reservation
}

export class ReserveBatchUseCase {
  constructor(
    private matchBatch: MatchBatchUseCase,
    private reservationsRepository: ReservationsRepository,
    private reservationTimeoutMinutes = 30,
  ) {}

  async execute({
    batchId,
    institutionId,
    now = new Date(),
  }: ReserveBatchUseCaseRequest): Promise<ReserveBatchUseCaseResponse> {
    const { ranking } = await this.matchBatch.execute({ batchId, now })

    const match = ranking.find((item) => item.institution.id === institutionId)

    if (!match) {
      throw new InstitutionNotEligibleError()
    }

    const reservation = await this.reservationsRepository.create({
      batchId,
      institutionId,
      score: match.score,
      expiresAt: new Date(now.getTime() + this.reservationTimeoutMinutes * 60_000),
    })

    return { reservation }
  }
}
