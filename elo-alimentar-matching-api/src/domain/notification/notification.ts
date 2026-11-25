import { AggregateRoot } from '@/core/entities/aggregate-root'
import { NotificationForAnotherRecipientError } from './errors/notification-for-another-recipient-error'

export const NOTIFICATION_RECIPIENTS = ['INSTITUTION', 'DONOR'] as const
export type NotificationRecipient = (typeof NOTIFICATION_RECIPIENTS)[number]

export const NOTIFICATION_TYPES = [
  // Para a instituição
  'OFFER_RECEIVED',
  'OFFER_REMINDER',
  'OFFER_TIMED_OUT',
  // Para o doador
  'OFFER_ACCEPTED',
  'OFFER_DECLINED',
  'OFFER_EXPIRED',
  'WAITING_FOR_INSTITUTION',
  'DONATION_COLLECTED',
  'BATCH_EXPIRED',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface NotificationProps {
  recipientType: NotificationRecipient
  recipientId: string
  type: NotificationType
  title: string
  message: string
  /** Lote a que a notificação se refere (abre o detalhe ao clicar). */
  batchId: string | null
  offerId: string | null
  createdAt: Date
  readAt: Date | null
}

/** Aviso para uma instituição ou um doador, mostrado no sininho do app. */
export class Notification extends AggregateRoot<NotificationProps> {
  static create(input: Omit<NotificationProps, 'readAt'>, id?: string) {
    return new Notification({ ...input, readAt: null }, id)
  }

  static restore(props: NotificationProps, id: string) {
    return new Notification({ ...props }, id)
  }

  /** Só o destinatário marca como lida. Idempotente. */
  markAsReadBy(recipientId: string, now: Date) {
    if (recipientId !== this.props.recipientId) {
      throw new NotificationForAnotherRecipientError()
    }

    this.props.readAt ??= now
  }

  get recipientType() {
    return this.props.recipientType
  }

  get recipientId() {
    return this.props.recipientId
  }

  get type() {
    return this.props.type
  }

  get title() {
    return this.props.title
  }

  get message() {
    return this.props.message
  }

  get batchId() {
    return this.props.batchId
  }

  get offerId() {
    return this.props.offerId
  }

  get createdAt() {
    return this.props.createdAt
  }

  get readAt() {
    return this.props.readAt
  }

  get isRead() {
    return this.props.readAt !== null
  }
}
