/** Erro de negócio. A camada HTTP traduz cada categoria em um status. */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** Valor de entrada que viola uma invariante (HTTP 400). */
export abstract class InvalidValueError extends DomainError {}

/** Ação proibida pelo estado atual do agregado (HTTP 409). */
export abstract class BusinessRuleViolationError extends DomainError {}

/** Quem pediu a ação não tem direito a ela (HTTP 403). */
export abstract class NotAllowedError extends DomainError {}
