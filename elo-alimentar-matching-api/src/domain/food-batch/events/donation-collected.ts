import type { DomainEvent } from '@/core/events/domain-event'
import type { BatchSnapshot } from './offer-events'

/** A instituição retirou o lote: o alimento entrou no estoque dela. */
export class DonationCollected implements DomainEvent {
  constructor(
    readonly batch: BatchSnapshot,
    readonly institutionId: string,
    readonly occurredAt: Date,
  ) {}

  get batchId() {
    return this.batch.batchId
  }

  get quantityKg() {
    return this.batch.quantityKg
  }
}
