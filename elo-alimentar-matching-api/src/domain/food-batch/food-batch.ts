import { AggregateRoot } from '@/core/entities/aggregate-root'
import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import { Coordinates } from '../shared/coordinates'
import type { FoodType, StorageCondition } from '../shared/food'
import { BatchAlreadyExpiredError } from './errors/batch-already-expired-error'
import { BatchNotAvailableError } from './errors/batch-not-available-error'
import { InvalidBatchQuantityError } from './errors/invalid-batch-quantity-error'
import { InvalidOfferStateError } from './errors/invalid-offer-state-error'
import { Offer } from './offer'

/**
 * AVAILABLE → sem oferta ativa (esperando a próxima instituição do ranking)
 * OFFERED   → oferecido a uma instituição, aguardando a resposta dela
 * RESERVED  → a instituição aceitou e vai retirar
 * COLLECTED → retirado
 * EXPIRED   → a validade passou antes de alguém aceitar
 */
export const BATCH_STATUSES = ['AVAILABLE', 'OFFERED', 'RESERVED', 'COLLECTED', 'EXPIRED'] as const
export type BatchStatus = (typeof BATCH_STATUSES)[number]

const MS_PER_HOUR = 1000 * 60 * 60

export interface FoodBatchProps {
  donorId: string
  foodType: FoodType
  quantityKg: number
  expiresAt: Date
  storageCondition: StorageCondition
  coordinates: Coordinates
  status: BatchStatus
  createdAt: Date
  offers: Offer[]
}

export interface RegisterFoodBatchInput {
  donorId: string
  foodType: FoodType
  quantityKg: number
  expiresAt: Date
  storageCondition: StorageCondition
  latitude: number
  longitude: number
}

export interface OfferToInput {
  institutionId: string
  score: number
  now: Date
  timeoutMinutes: number
}

/**
 * Raiz do agregado "lote de alimentos". Reúne o lote e a fila de ofertas
 * já feitas, porque o status do lote depende delas:
 *
 *   AVAILABLE --offerTo--> OFFERED --acceptOffer--> RESERVED --completePickup--> COLLECTED
 *       ^                     |
 *       +---decline/expire----+     (o sistema então oferece à próxima do ranking)
 *
 *   AVAILABLE / OFFERED --validade vencida--> EXPIRED
 */
export class FoodBatch extends AggregateRoot<FoodBatchProps> {
  static register(input: RegisterFoodBatchInput, now: Date, id?: string) {
    if (!(input.quantityKg > 0)) {
      throw new InvalidBatchQuantityError()
    }

    if (input.expiresAt.getTime() <= now.getTime()) {
      throw new BatchAlreadyExpiredError()
    }

    const coordinates = Coordinates.create(input.latitude, input.longitude)

    return new FoodBatch(
      {
        donorId: input.donorId,
        foodType: input.foodType,
        quantityKg: input.quantityKg,
        expiresAt: input.expiresAt,
        storageCondition: input.storageCondition,
        coordinates,
        status: 'AVAILABLE',
        createdAt: now,
        offers: [],
      },
      id,
    )
  }

  /** Reconstrói a partir da persistência; os dados já foram validados ao entrar. */
  static restore(props: FoodBatchProps, id: string) {
    return new FoodBatch({ ...props, offers: [...props.offers] }, id)
  }

  get donorId() {
    return this.props.donorId
  }

  get foodType() {
    return this.props.foodType
  }

  get quantityKg() {
    return this.props.quantityKg
  }

  get expiresAt() {
    return this.props.expiresAt
  }

  get storageCondition() {
    return this.props.storageCondition
  }

  get coordinates() {
    return this.props.coordinates
  }

  get latitude() {
    return this.props.coordinates.latitude
  }

  get longitude() {
    return this.props.coordinates.longitude
  }

  get status() {
    return this.props.status
  }

  get createdAt() {
    return this.props.createdAt
  }

  /** Histórico de ofertas, em ordem de criação. */
  get offers(): readonly Offer[] {
    return this.props.offers
  }

  /** Oferta pendente ou aceita, se houver. */
  get activeOffer() {
    return this.props.offers.find((offer) => offer.isPending || offer.isAccepted) ?? null
  }

  /** Pode receber uma nova oferta agora. */
  get isAvailable() {
    return this.props.status === 'AVAILABLE'
  }

  /** Ainda não foi retirado nem venceu. */
  get isOpen() {
    return this.props.status !== 'COLLECTED' && this.props.status !== 'EXPIRED'
  }

  hoursUntilExpiry(now: Date) {
    return (this.props.expiresAt.getTime() - now.getTime()) / MS_PER_HOUR
  }

  isPastValidity(now: Date) {
    return this.props.expiresAt.getTime() <= now.getTime()
  }

  /** Quem recusou ou deixou a oferta expirar não recebe este lote de novo (RN08). */
  institutionsAlreadyTried(): ReadonlySet<string> {
    return new Set(
      this.props.offers
        .filter((offer) => offer.isClosedWithoutAcceptance)
        .map((offer) => offer.institutionId),
    )
  }

  /** Oferece o lote a uma instituição. Só uma oferta ativa por vez (RN06). */
  offerTo({ institutionId, score, now, timeoutMinutes }: OfferToInput) {
    if (!this.isAvailable || this.isPastValidity(now)) {
      throw new BatchNotAvailableError()
    }

    const offer = Offer.make({
      batchId: this.id,
      institutionId,
      score,
      now,
      timeoutMinutes,
    })

    this.props.offers.push(offer)
    this.props.status = 'OFFERED'

    return offer
  }

  acceptOffer(offerId: string, institutionId: string, now: Date) {
    const offer = this.getOffer(offerId)

    offer.accept(institutionId, now)
    this.props.status = 'RESERVED'

    return offer
  }

  /** Recusa: o lote volta a AVAILABLE para ser oferecido à próxima (RN08). */
  declineOffer(offerId: string, institutionId: string, now: Date) {
    const offer = this.getOffer(offerId)

    offer.decline(institutionId, now)
    this.props.status = 'AVAILABLE'

    return offer
  }

  /** Expira as ofertas sem resposta no prazo e devolve o lote à fila (RN04, RN08). */
  expireOverdueOffers(now: Date) {
    const overdue = this.props.offers.filter((offer) => offer.isOverdue(now))

    for (const offer of overdue) {
      offer.expire()
    }

    if (overdue.length > 0) {
      this.props.status = 'AVAILABLE'
    }

    return overdue
  }

  /**
   * A validade passou antes de alguém aceitar: o lote sai de circulação.
   * Um lote já aceito (RESERVED) não é afetado: a instituição já está a caminho.
   */
  expireIfPastValidity(now: Date) {
    const canExpire = this.props.status === 'AVAILABLE' || this.props.status === 'OFFERED'

    if (!canExpire || !this.isPastValidity(now)) {
      return false
    }

    for (const offer of this.props.offers) {
      if (offer.isPending) {
        offer.expire()
      }
    }

    this.props.status = 'EXPIRED'

    return true
  }

  /** Retirada concluída pela instituição que aceitou. */
  completePickup(offerId: string, institutionId: string) {
    const offer = this.getOffer(offerId)

    offer.ensureCanBePickedUpBy(institutionId)

    if (this.props.status !== 'RESERVED') {
      throw new InvalidOfferStateError()
    }

    this.props.status = 'COLLECTED'

    return offer
  }

  private getOffer(offerId: string) {
    const offer = this.props.offers.find((item) => item.id === offerId)

    if (!offer) {
      throw new ResourceNotFoundError()
    }

    return offer
  }
}
