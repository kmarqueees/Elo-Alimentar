import {
  Institution,
  type RegisterInstitutionInput,
} from '@/domain/institution/institution'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'

type RegisterInstitutionUseCaseRequest = RegisterInstitutionInput

interface RegisterInstitutionUseCaseResponse {
  institution: Institution
}

export class RegisterInstitutionUseCase {
  constructor(private institutionsRepository: InstitutionsRepository) {}

  async execute(
    request: RegisterInstitutionUseCaseRequest,
  ): Promise<RegisterInstitutionUseCaseResponse> {
    const institution = Institution.register(request)

    await this.institutionsRepository.create(institution)

    return { institution }
  }
}
