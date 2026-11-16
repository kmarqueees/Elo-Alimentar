import type { InstitutionsRepository } from '@/repositories/institutions-repository'
import type { Institution } from '@/matching/types'

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
