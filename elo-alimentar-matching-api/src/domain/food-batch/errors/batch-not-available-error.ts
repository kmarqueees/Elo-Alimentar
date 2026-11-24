import { BusinessRuleViolationError } from '@/core/errors/domain-error'

export class BatchNotAvailableError extends BusinessRuleViolationError {
  constructor() {
    super('Batch is not available for matching.')
  }
}
