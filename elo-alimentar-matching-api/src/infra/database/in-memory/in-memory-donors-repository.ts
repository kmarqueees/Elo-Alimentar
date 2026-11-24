import type { DonorsRepository } from '@/domain/donor/donors-repository'

/**
 * O modo em memória não tem cadastro de usuários. Por padrão aceita qualquer
 * doador (como antes da refatoração); passe uma lista para restringir.
 */
export class InMemoryDonorsRepository implements DonorsRepository {
  constructor(private knownDonorIds: string[] | null = null) {}

  async exists(donorId: string) {
    return this.knownDonorIds === null || this.knownDonorIds.includes(donorId)
  }
}
