export class InstitutionNotEligibleError extends Error {
  constructor() {
    super('Institution is not eligible for this batch.')
  }
}
