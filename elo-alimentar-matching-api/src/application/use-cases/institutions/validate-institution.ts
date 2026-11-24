import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import type { Institution } from '@/domain/institution/institution'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'

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
    const institution = await this.institutionsRepository.findById(institutionId)

    if (!institution) {
      throw new ResourceNotFoundError()
    }

    institution.validate()

    await this.institutionsRepository.save(institution)

    return { institution }
  }
}
