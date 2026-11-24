import type { Institution } from '@/domain/institution/institution'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'

interface ListInstitutionsUseCaseResponse {
  institutions: Institution[]
}

export class ListInstitutionsUseCase {
  constructor(private institutionsRepository: InstitutionsRepository) {}

  async execute(): Promise<ListInstitutionsUseCaseResponse> {
    const institutions = await this.institutionsRepository.findMany()

    return { institutions }
  }
}
