import type { DomainEvent } from '@/core/events/domain-event'
import type { FoodType } from '../../shared/food'

/** Dados do lote que acompanham os eventos, para montar mensagens sem nova consulta. */
export interface BatchSnapshot {
  batchId: string
  donorId: string
  foodType: FoodType
  quantityKg: number
}

/** O lote foi oferecido a uma instituição, que tem até `respondBy` para responder. */
export class OfferMade implements DomainEvent {
  constructor(
    readonly batch: BatchSnapshot,
    readonly offerId: string,
    readonly institutionId: string,
    readonly respondBy: Date,
    readonly occurredAt: Date,
  ) {}
}

/** Faltam poucos minutos para a oferta expirar e a instituição ainda não respondeu. */
export class OfferReminderDue implements DomainEvent {
  constructor(
    readonly batch: BatchSnapshot,
    readonly offerId: string,
    readonly institutionId: string,
    readonly respondBy: Date,
    readonly occurredAt: Date,
  ) {}
}

export class OfferAccepted implements DomainEvent {
  constructor(
    readonly batch: BatchSnapshot,
    readonly offerId: string,
    readonly institutionId: string,
    readonly occurredAt: Date,
  ) {}
}

export class OfferDeclined implements DomainEvent {
  constructor(
    readonly batch: BatchSnapshot,
    readonly offerId: string,
    readonly institutionId: string,
    readonly occurredAt: Date,
  ) {}
}

/** A instituição não respondeu no prazo. */
export class OfferExpired implements DomainEvent {
  constructor(
    readonly batch: BatchSnapshot,
    readonly offerId: string,
    readonly institutionId: string,
    readonly occurredAt: Date,
  ) {}
}

/** O lote ficou sem oferta ativa e não há instituição disponível agora. */
export class WaitingForInstitution implements DomainEvent {
  constructor(
    readonly batch: BatchSnapshot,
    readonly occurredAt: Date,
  ) {}
}

/**
 * A validade passou antes de alguma instituição aceitar. Se havia uma oferta
 * aguardando resposta, `pendingInstitutionId` indica quem a recebeu.
 */
export class BatchExpired implements DomainEvent {
  constructor(
    readonly batch: BatchSnapshot,
    readonly pendingInstitutionId: string | null,
    readonly occurredAt: Date,
  ) {}
}
