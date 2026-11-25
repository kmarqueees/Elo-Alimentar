import { AggregateRoot } from '@/core/entities/aggregate-root'
import { Coordinates } from '../shared/coordinates'
import type { FoodType } from '../shared/food'
import { InvalidCapacityError } from './errors/invalid-capacity-error'
import { InvalidPeopleServedError } from './errors/invalid-people-served-error'
import { InvalidStockError } from './errors/invalid-stock-error'
import { DEFAULT_STOCK_POLICY, type StockPolicy } from './stock-policy'

const MS_PER_DAY = 1000 * 60 * 60 * 24

export interface InstitutionProps {
  name: string
  coordinates: Coordinates
  hasRefrigeration: boolean
  /** Quanto cabe no espaço de armazenamento da instituição, em kg. */
  storageCapacityKg: number
  /** Pessoas atendidas por dia. 0 só aparece em registros antigos (consumo desconhecido). */
  peopleServed: number
  /** Estoque no instante `stockUpdatedAt` (informado ou ajustado por doação). */
  stockKg: number
  stockUpdatedAt: Date
  acceptedFoodTypes: FoodType[]
  validated: boolean
}

export interface RegisterInstitutionInput {
  name: string
  latitude: number
  longitude: number
  hasRefrigeration: boolean
  storageCapacityKg: number
  peopleServed: number
  stockKg?: number
  acceptedFoodTypes?: FoodType[]
}

/** Instituição receptora de doações (ONG, cozinha comunitária, abrigo...). */
export class Institution extends AggregateRoot<InstitutionProps> {
  /** Cadastro: nasce NÃO validada, até o administrador aprovar (RN03). */
  static register(input: RegisterInstitutionInput, now: Date, id?: string) {
    if (!(input.storageCapacityKg > 0)) {
      throw new InvalidCapacityError()
    }

    if (!(Number.isInteger(input.peopleServed) && input.peopleServed > 0)) {
      throw new InvalidPeopleServedError()
    }

    const stockKg = input.stockKg ?? 0

    if (!(stockKg >= 0)) {
      throw new InvalidStockError()
    }

    const coordinates = Coordinates.create(input.latitude, input.longitude)

    return new Institution(
      {
        name: input.name,
        coordinates,
        hasRefrigeration: input.hasRefrigeration,
        storageCapacityKg: input.storageCapacityKg,
        peopleServed: input.peopleServed,
        stockKg,
        stockUpdatedAt: now,
        acceptedFoodTypes: [...(input.acceptedFoodTypes ?? [])],
        validated: false,
      },
      id,
    )
  }

  /** Reconstrói a partir da persistência; os dados já foram validados ao entrar. */
  static restore(props: InstitutionProps, id: string) {
    return new Institution({ ...props, acceptedFoodTypes: [...props.acceptedFoodTypes] }, id)
  }

  /** Aprovação pelo administrador (RN03). Idempotente. */
  validate() {
    this.props.validated = true
  }

  // ---------- Estoque ----------

  dailyConsumptionKg(policy: StockPolicy = DEFAULT_STOCK_POLICY) {
    return this.props.peopleServed * policy.kgPerPersonPerDay
  }

  /**
   * Estoque estimado agora: o último valor conhecido menos o consumo desde
   * então. Nunca fica negativo.
   */
  estimatedStockKg(now: Date, policy: StockPolicy = DEFAULT_STOCK_POLICY) {
    const elapsedDays = Math.max(0, now.getTime() - this.props.stockUpdatedAt.getTime()) / MS_PER_DAY
    const consumed = this.dailyConsumptionKg(policy) * elapsedDays

    return Math.max(0, this.props.stockKg - consumed)
  }

  /** Para quantos dias o estoque estimado dá. Infinito se o consumo é desconhecido. */
  stockDays(now: Date, policy: StockPolicy = DEFAULT_STOCK_POLICY) {
    const daily = this.dailyConsumptionKg(policy)

    return daily > 0 ? this.estimatedStockKg(now, policy) / daily : Number.POSITIVE_INFINITY
  }

  /** Espaço livre no armazenamento, considerando o estoque estimado. */
  freeStorageKg(now: Date, policy: StockPolicy = DEFAULT_STOCK_POLICY) {
    return Math.max(0, this.props.storageCapacityKg - this.estimatedStockKg(now, policy))
  }

  /** A instituição informa o estoque real: a estimativa recomeça deste valor. */
  updateStock(stockKg: number, now: Date) {
    if (!(stockKg >= 0)) {
      throw new InvalidStockError()
    }

    this.props.stockKg = stockKg
    this.props.stockUpdatedAt = now
  }

  /** Uma doação foi retirada: soma ao estoque estimado. */
  receiveDonation(quantityKg: number, now: Date, policy: StockPolicy = DEFAULT_STOCK_POLICY) {
    this.props.stockKg = this.estimatedStockKg(now, policy) + quantityKg
    this.props.stockUpdatedAt = now
  }

  // ---------- Leitura ----------

  get name() {
    return this.props.name
  }

  get coordinates() {
    return this.props.coordinates
  }

  get latitude() {
    return this.props.coordinates.latitude
  }

  get longitude() {
    return this.props.coordinates.longitude
  }

  get hasRefrigeration() {
    return this.props.hasRefrigeration
  }

  get storageCapacityKg() {
    return this.props.storageCapacityKg
  }

  get peopleServed() {
    return this.props.peopleServed
  }

  /** Último estoque conhecido (sem o desconto do consumo). Use estimatedStockKg para o valor atual. */
  get stockKg() {
    return this.props.stockKg
  }

  get stockUpdatedAt() {
    return this.props.stockUpdatedAt
  }

  get acceptedFoodTypes(): readonly FoodType[] {
    return this.props.acceptedFoodTypes
  }

  get validated() {
    return this.props.validated
  }
}
