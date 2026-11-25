import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import type { Institution } from '@/domain/institution/institution'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'

interface UpdateInstitutionStockUseCaseRequest {
  institutionId: string
  stockKg: number
  now: Date
}

/**
 * A instituição informa o estoque real. A partir daí o sistema volta a
 * estimar sozinho: desconta o consumo diário e soma as doações retiradas.
 */
export class UpdateInstitutionStockUseCase {
  constructor(private institutionsRepository: InstitutionsRepository) {}

  async execute({
    institutionId,
    stockKg,
    now,
  }: UpdateInstitutionStockUseCaseRequest): Promise<{ institution: Institution }> {
    const institution = await this.institutionsRepository.findById(institutionId)

    if (!institution) {
      throw new ResourceNotFoundError()
    }

    institution.updateStock(stockKg, now)

    await this.institutionsRepository.save(institution)

    return { institution }
  }
}
