import { randomUUID } from 'node:crypto'

/**
 * Entidade: tem identidade própria, que nasce no domínio (não no banco).
 * As props ficam protegidas; o estado só muda pelos métodos da subclasse.
 */
export abstract class Entity<Props> {
  private readonly _id: string
  protected props: Props

  protected constructor(props: Props, id?: string) {
    this.props = props
    this._id = id ?? randomUUID()
  }

  get id() {
    return this._id
  }

  equals(other: Entity<unknown>) {
    return other === this || other.id === this._id
  }
}
