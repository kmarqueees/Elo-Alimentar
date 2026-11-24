import { DomainError } from './domain-error'

/** Recurso inexistente (HTTP 404). A mensagem é usada como chave pelo front end. */
export class ResourceNotFoundError extends DomainError {
  constructor() {
    super('Resource not found.')
  }
}
