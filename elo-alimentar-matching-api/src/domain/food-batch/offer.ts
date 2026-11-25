import { Entity } from '@/core/entities/entity'
import { InvalidOfferStateError } from './errors/invalid-offer-state-error'
import { OfferExpiredError } from './errors/offer-expired-error'
import { OfferForAnotherInstitutionError } from './errors/offer-for-another-institution-error'

/**
 * PENDING  → oferecida, aguardando a resposta da instituição
 * ACCEPTED → a instituição aceitou e vai retirar
 * DECLINED → a instituição recusou
 * EXPIRED  → a instituição não respondeu no prazo (RN04)
 */
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'

export interface OfferProps {
  batchId: string
  institutionId: string
  score: number
  status: OfferStatus
  createdAt: Date
  expiresAt: Date
  respondedAt: Date | null
  /** Quando a instituição foi lembrada de que o prazo está acabando. */
  remindedAt: Date | null
}

/**
 * Oferta de um lote a UMA instituição, feita na ordem do ranking.
 * Entidade interna do agregado FoodBatch: só o lote cria e altera ofertas,
 * garantindo que exista no máximo uma oferta ativa por vez.
 */
export class Offer extends Entity<OfferProps> {
  static make(
    input: { batchId: string; institutionId: string; score: number; now: Date; timeoutMinutes: number },
    id?: string,
  ) {
    return new Offer(
      {
        batchId: input.batchId,
        institutionId: input.institutionId,
        score: input.score,
        status: 'PENDING',
        createdAt: input.now,
        expiresAt: new Date(input.now.getTime() + input.timeoutMinutes * 60_000),
        respondedAt: null,
        remindedAt: null,
      },
      id,
    )
  }

  static restore(props: OfferProps, id: string) {
    return new Offer({ ...props }, id)
  }

  get batchId() {
    return this.props.batchId
  }

  get institutionId() {
    return this.props.institutionId
  }

  get score() {
    return this.props.score
  }

  get status() {
    return this.props.status
  }

  get createdAt() {
    return this.props.createdAt
  }

  get expiresAt() {
    return this.props.expiresAt
  }

  get respondedAt() {
    return this.props.respondedAt
  }

  get remindedAt() {
    return this.props.remindedAt
  }

  get isPending() {
    return this.props.status === 'PENDING'
  }

  get isAccepted() {
    return this.props.status === 'ACCEPTED'
  }

  /** Oferta encerrada sem aceite: a instituição não recebe este lote de novo (RN08). */
  get isClosedWithoutAcceptance() {
    return this.props.status === 'DECLINED' || this.props.status === 'EXPIRED'
  }

  isOverdue(now: Date) {
    return this.isPending && this.props.expiresAt.getTime() <= now.getTime()
  }

  /**
   * O lembrete é devido quando faltam `leadMinutes` ou menos, a oferta segue
   * pendente e ainda não foi lembrada. Ofertas com prazo total menor que o
   * aviso não recebem lembrete (seria imediato).
   */
  isReminderDue(now: Date, leadMinutes: number) {
    const leadMs = leadMinutes * 60_000
    const remaining = this.props.expiresAt.getTime() - now.getTime()
    const window = this.props.expiresAt.getTime() - this.props.createdAt.getTime()

    return this.isPending && this.props.remindedAt === null && window > leadMs && remaining > 0 && remaining <= leadMs
  }

  markReminded(now: Date) {
    this.props.remindedAt = now
  }

  /** A instituição ofertada aceita dentro do prazo. */
  accept(institutionId: string, now: Date) {
    this.ensureAddressedTo(institutionId)

    if (!this.isPending) {
      throw new InvalidOfferStateError()
    }

    if (this.isOverdue(now)) {
      throw new OfferExpiredError()
    }

    this.props.status = 'ACCEPTED'
    this.props.respondedAt = now
  }

  /** A instituição ofertada recusa (ex.: sem espaço hoje). */
  decline(institutionId: string, now: Date) {
    this.ensureAddressedTo(institutionId)

    if (!this.isPending) {
      throw new InvalidOfferStateError()
    }

    this.props.status = 'DECLINED'
    this.props.respondedAt = now
  }

  /** Prazo de resposta esgotado (ou lote vencido) sem resposta. */
  expire() {
    if (!this.isPending) {
      throw new InvalidOfferStateError()
    }

    this.props.status = 'EXPIRED'
  }

  ensureCanBePickedUpBy(institutionId: string) {
    this.ensureAddressedTo(institutionId)

    if (!this.isAccepted) {
      throw new InvalidOfferStateError()
    }
  }

  private ensureAddressedTo(institutionId: string) {
    if (this.props.institutionId !== institutionId) {
      throw new OfferForAnotherInstitutionError()
    }
  }
}
