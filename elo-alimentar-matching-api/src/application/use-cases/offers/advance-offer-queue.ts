import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'
import type { SequentialOfferService } from '@/domain/matching/sequential-offer-service'

interface AdvanceOfferQueueUseCaseRequest {
  now: Date
}

interface AdvanceOfferQueueUseCaseResponse {
  /** Ofertas encerradas porque a instituição não respondeu no prazo. */
  expiredOffers: number
  /** Novas ofertas feitas à próxima instituição do ranking. */
  newOffers: number
  /** Lotes que venceram antes de alguém aceitar. */
  expiredBatches: number
}

/**
 * Varredura periódica que faz a fila de ofertas andar:
 *  1. lote vencido sem aceite → EXPIRED;
 *  2. oferta sem resposta no prazo → EXPIRED (RN04);
 *  3. lote sem oferta ativa → oferece à próxima instituição do ranking (RN08).
 *
 * O passo 3 também cobre lotes que ficaram sem candidata e passam a ter uma
 * (ex.: o administrador validou uma instituição nova).
 */
export class AdvanceOfferQueueUseCase {
  constructor(
    private batchesRepository: FoodBatchesRepository,
    private institutionsRepository: InstitutionsRepository,
    private offers: SequentialOfferService,
  ) {}

  async execute({
    now,
  }: AdvanceOfferQueueUseCaseRequest): Promise<AdvanceOfferQueueUseCaseResponse> {
    const batches = await this.batchesRepository.findManyInOfferQueue()
    const institutions = await this.institutionsRepository.findManyValidated()

    const result = { expiredOffers: 0, newOffers: 0, expiredBatches: 0 }

    for (const batch of batches) {
      let changed = false

      if (batch.expireIfPastValidity(now)) {
        result.expiredBatches += 1
        changed = true
      } else {
        const expired = batch.expireOverdueOffers(now)
        const next = this.offers.offerToNext(batch, institutions, now)

        result.expiredOffers += expired.length
        result.newOffers += next ? 1 : 0
        changed = expired.length > 0 || next !== null
      }

      if (changed) {
        await this.batchesRepository.save(batch)
      }
    }

    return result
  }
}
