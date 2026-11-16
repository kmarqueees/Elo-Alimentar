import type { InstitutionsRepository } from '@/repositories/institutions-repository'
import type { Institution } from '@/matching/types'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface ValidateInstitutionUseCaseRequest {
  institutionId: string
}

interface ValidateInstitutionUseCaseResponse {
  institution: Institution
}

export class ValidateInstitutionUseCase {
  constructor(private institutionsRepository: InstitutionsRepository) {}

  async execute({
    institutionId,
  }: ValidateInstitutionUseCaseRequest): Promise<ValidateInstitutionUseCaseResponse> {
    const institution = await this.institutionsRepository.validate(institutionId)

    if (!institution) {
      throw new ResourceNotFoundError()
    }

    return { institution }
  }
}
