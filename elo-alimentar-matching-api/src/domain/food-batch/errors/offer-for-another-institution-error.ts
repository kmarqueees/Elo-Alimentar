import { NotAllowedError } from '@/core/errors/domain-error'

export class OfferForAnotherInstitutionError extends NotAllowedError {
  constructor() {
    super('This offer was made to another institution.')
  }
}
