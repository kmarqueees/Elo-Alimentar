import { BusinessRuleViolationError } from '@/core/errors/domain-error'

export class OfferExpiredError extends BusinessRuleViolationError {
  constructor() {
    super('Offer has expired.')
  }
}
