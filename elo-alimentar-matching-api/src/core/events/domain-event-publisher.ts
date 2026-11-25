import type { DomainEvent } from './domain-event'

type EventClass<E extends DomainEvent> = abstract new (...args: never[]) => E
type Handler<E extends DomainEvent> = (event: E) => Promise<void>

/**
 * Publicador de eventos em processo. O caso de uso salva o agregado e depois
 * publica os eventos que ele registrou; os handlers atualizam outros
 * agregados (consistência eventual entre agregados, como o DDD recomenda).
 */
export class DomainEventPublisher {
  private handlers: { type: EventClass<DomainEvent>; handle: Handler<DomainEvent> }[] = []

  subscribe<E extends DomainEvent>(type: EventClass<E>, handle: Handler<E>) {
    this.handlers.push({ type, handle: handle as Handler<DomainEvent> })
  }

  /**
   * Os eventos são publicados depois que a operação principal já foi salva.
   * Por isso a falha de um handler é registrada, mas não desfaz nem derruba a
   * operação que gerou o evento.
   */
  async publish(events: readonly DomainEvent[]) {
    for (const event of events) {
      for (const { type, handle } of this.handlers) {
        if (!(event instanceof type)) {
          continue
        }

        try {
          await handle(event)
        } catch (error) {
          console.error(`Falha ao tratar o evento ${event.constructor.name}:`, error)
        }
      }
    }
  }
}
