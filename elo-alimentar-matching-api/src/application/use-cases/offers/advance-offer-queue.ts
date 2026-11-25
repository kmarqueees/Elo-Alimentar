import type { DomainEventPublisher } from '@/core/events/domain-event-publisher'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'
import { InstitutionWorkload } from '@/domain/matching/institution-workload'
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
  /** Instituições lembradas de que o prazo de resposta está acabando. */
  reminders: number
}

/**
 * Varredura periódica que faz a fila de ofertas andar:
 *  1. lote vencido sem aceite → EXPIRED;
 *  2. oferta sem resposta no prazo → EXPIRED (RN04);
 *  3. lote sem oferta ativa → oferece à próxima instituição do ranking (RN08);
 *  4. oferta perto de expirar → lembrete à instituição (uma vez por oferta).
 *
 * O passo 3 também cobre lotes que ficaram sem candidata e passam a ter uma
 * (ex.: o administrador validou uma instituição nova).
 */
export class AdvanceOfferQueueUseCase {
  constructor(
    private batchesRepository: FoodBatchesRepository,
    private institutionsRepository: InstitutionsRepository,
    private offers: SequentialOfferService,
    private events: DomainEventPublisher,
    private reminderLeadMinutes = 10,
  ) {}

  async execute({
    now,
  }: AdvanceOfferQueueUseCaseRequest): Promise<AdvanceOfferQueueUseCaseResponse> {
    // Quem vence antes é atendido antes: com o limite de lotes por instituição,
    // as vagas são escassas e devem ir primeiro para o alimento mais perecível.
    const batches = (await this.batchesRepository.findManyInOfferQueue()).sort(
      (a, b) => a.expiresAt.getTime() - b.expiresAt.getTime(),
    )
    const institutions = await this.institutionsRepository.findManyValidated()
    // Carga atual de cada instituição; atualizada a cada lote processado nesta rodada.
    const workload = InstitutionWorkload.fromBatches(
      await this.batchesRepository.findManyWithOpenOffers(),
    )

    const result = { expiredOffers: 0, newOffers: 0, expiredBatches: 0, reminders: 0 }

    for (const batch of batches) {
      let changed = false

      if (batch.expireIfPastValidity(now)) {
        result.expiredBatches += 1
        changed = true
        workload.track(batch)
      } else {
        const expired = batch.expireOverdueOffers(now)

        workload.track(batch)

        const next = this.offers.offerToNext(batch, institutions, now, workload)
        const reminded = batch.remindPendingOffers(now, this.reminderLeadMinutes)

        // Avisa o doador só quando o lote acabou de ficar sem oferta, não a cada varredura.
        if (expired.length > 0 && !next) {
          batch.reportWaitingForInstitution(now)
        }

        result.expiredOffers += expired.length
        result.newOffers += next ? 1 : 0
        result.reminders += reminded.length
        changed = expired.length > 0 || next !== null || reminded.length > 0
      }

      if (changed) {
        await this.batchesRepository.save(batch)
        await this.events.publish(batch.pullDomainEvents())
      }
    }

    return result
  }
}
