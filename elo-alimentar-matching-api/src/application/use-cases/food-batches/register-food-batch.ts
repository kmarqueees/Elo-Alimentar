import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import type { DonorsRepository } from '@/domain/donor/donors-repository'
import {
  FoodBatch,
  type RegisterFoodBatchInput,
} from '@/domain/food-batch/food-batch'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'
import type { SequentialOfferService } from '@/domain/matching/sequential-offer-service'

interface RegisterFoodBatchUseCaseRequest extends RegisterFoodBatchInput {
  now: Date
}

interface RegisterFoodBatchUseCaseResponse {
  batch: FoodBatch
}

/**
 * O doador cadastra o lote e o sistema já o oferece à 1ª instituição do
 * ranking. Se ninguém for elegível agora, o lote fica AVAILABLE e a varredura
 * tenta de novo depois.
 */
export class RegisterFoodBatchUseCase {
  constructor(
    private batchesRepository: FoodBatchesRepository,
    private donorsRepository: DonorsRepository,
    private institutionsRepository: InstitutionsRepository,
    private offers: SequentialOfferService,
  ) {}

  async execute({
    now,
    ...input
  }: RegisterFoodBatchUseCaseRequest): Promise<RegisterFoodBatchUseCaseResponse> {
    const batch = FoodBatch.register(input, now)

    if (!(await this.donorsRepository.exists(batch.donorId))) {
      throw new ResourceNotFoundError()
    }

    const institutions = await this.institutionsRepository.findManyValidated()

    this.offers.offerToNext(batch, institutions, now)

    await this.batchesRepository.create(batch)

    return { batch }
  }
}
