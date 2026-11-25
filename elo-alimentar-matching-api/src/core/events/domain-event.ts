/** Algo relevante que aconteceu no domínio e que outras partes podem reagir. */
export interface DomainEvent {
  readonly occurredAt: Date
}
