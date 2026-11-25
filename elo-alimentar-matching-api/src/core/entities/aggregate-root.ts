import type { DomainEvent } from '../events/domain-event'
import { Entity } from './entity'

/**
 * Raiz de agregado: a única porta de entrada para alterar o agregado.
 * Repositórios carregam e salvam agregados inteiros, nunca partes deles.
 * O agregado também registra os eventos de domínio que gerou.
 */
export abstract class AggregateRoot<Props> extends Entity<Props> {
  private domainEvents: DomainEvent[] = []

  protected addDomainEvent(event: DomainEvent) {
    this.domainEvents.push(event)
  }

  /** Devolve e limpa os eventos registrados, para serem publicados após salvar. */
  pullDomainEvents(): DomainEvent[] {
    const events = this.domainEvents

    this.domainEvents = []

    return events
  }
}
