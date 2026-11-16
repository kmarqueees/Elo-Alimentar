import type { InstitutionsRepository } from '@/repositories/institutions-repository'
import type { FoodType, Institution } from '@/matching/types'
import { InvalidCapacityError } from './errors/invalid-capacity-error'
import { isValidCoordinates } from '@/utils/is-valid-coordinates'
import { InvalidCoordinatesError } from './errors/invalid-coordinates-error'

interface RegisterInstitutionUseCaseRequest {
  name: string
  latitude: number
  longitude: number
  hasRefrigeration: boolean
  availableCapacityKg: number
  acceptedFoodTypes?: FoodType[]
}

interface RegisterInstitutionUseCaseResponse {
  institution: Institution
}

export class RegisterInstitutionUseCase {
  constructor(private institutionsRepository: InstitutionsRepository) {}

  async execute({
    name,
    latitude,
    longitude,
    hasRefrigeration,
    availableCapacityKg,
    acceptedFoodTypes = [],
  }: RegisterInstitutionUseCaseRequest): Promise<RegisterInstitutionUseCaseResponse> {
    if (!(availableCapacityKg > 0)) {
      throw new InvalidCapacityError()
    }

    if (!isValidCoordinates(latitude, longitude)) {
      throw new InvalidCoordinatesError()
    }

    const institution = await this.institutionsRepository.create({
      name,
      latitude,
      longitude,
      hasRefrigeration,
      availableCapacityKg,
      acceptedFoodTypes,
      validated: false,
    })

    return { institution }
  }
}
