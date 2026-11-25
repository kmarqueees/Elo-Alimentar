import { NotAllowedError } from '@/core/errors/domain-error'

export class NotificationForAnotherRecipientError extends NotAllowedError {
  constructor() {
    super('This notification belongs to someone else.')
  }
}
