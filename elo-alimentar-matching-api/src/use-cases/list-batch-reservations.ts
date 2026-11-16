import type { FoodBatchesRepository } from '@/repositories/food-batches-repository'
import type { ReservationsRepository } from '@/repositories/reservations-repository'
import type { Reservation } from '@/matching/types'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface ListBatchReservationsUseCaseRequest {
  batchId: string
}

export class ListBatchReservationsUseCase {
  constructor(
    private batchesRepository: FoodBatchesRepository,
    private reservationsRepository: ReservationsRepository,
  ) {}

  async execute({
    batchId,
  }: ListBatchReservationsUseCaseRequest): Promise<{ reservations: Reservation[] }> {
    const batch = await this.batchesRepository.findById(batchId)

    if (!batch) {
      throw new ResourceNotFoundError()
    }

    return {
      reservations: await this.reservationsRepository.findManyByBatchId(batchId),
    }
  }
}
