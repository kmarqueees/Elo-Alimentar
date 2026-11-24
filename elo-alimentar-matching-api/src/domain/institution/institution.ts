import { AggregateRoot } from '@/core/entities/aggregate-root'
import { Coordinates } from '../shared/coordinates'
import type { FoodType } from '../shared/food'
import { InvalidCapacityError } from './errors/invalid-capacity-error'

export interface InstitutionProps {
  name: string
  coordinates: Coordinates
  hasRefrigeration: boolean
  availableCapacityKg: number
  acceptedFoodTypes: FoodType[]
  validated: boolean
}

export interface RegisterInstitutionInput {
  name: string
  latitude: number
  longitude: number
  hasRefrigeration: boolean
  availableCapacityKg: number
  acceptedFoodTypes?: FoodType[]
}

/** Instituição receptora de doações (ONG, cozinha comunitária, abrigo...). */
export class Institution extends AggregateRoot<InstitutionProps> {
  /** Cadastro: nasce NÃO validada, até o administrador aprovar (RN03). */
  static register(input: RegisterInstitutionInput, id?: string) {
    if (!(input.availableCapacityKg > 0)) {
      throw new InvalidCapacityError()
    }

    const coordinates = Coordinates.create(input.latitude, input.longitude)

    return new Institution(
      {
        name: input.name,
        coordinates,
        hasRefrigeration: input.hasRefrigeration,
        availableCapacityKg: input.availableCapacityKg,
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

  get availableCapacityKg() {
    return this.props.availableCapacityKg
  }

  get acceptedFoodTypes(): readonly FoodType[] {
    return this.props.acceptedFoodTypes
  }

  get validated() {
    return this.props.validated
  }
}
