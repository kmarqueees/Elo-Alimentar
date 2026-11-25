import {
  Institution,
  type RegisterInstitutionInput,
} from '@/domain/institution/institution'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'

interface RegisterInstitutionUseCaseRequest extends RegisterInstitutionInput {
  now: Date
}

interface RegisterInstitutionUseCaseResponse {
  institution: Institution
}

export class RegisterInstitutionUseCase {
  constructor(private institutionsRepository: InstitutionsRepository) {}

  async execute({
    now,
    ...input
  }: RegisterInstitutionUseCaseRequest): Promise<RegisterInstitutionUseCaseResponse> {
    const institution = Institution.register(input, now)

    await this.institutionsRepository.create(institution)

    return { institution }
  }
}
