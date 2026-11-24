import { BusinessRuleViolationError } from '@/core/errors/domain-error'

export class InvalidOfferStateError extends BusinessRuleViolationError {
  constructor() {
    super('Offer is not in a state that allows this action.')
  }
}
