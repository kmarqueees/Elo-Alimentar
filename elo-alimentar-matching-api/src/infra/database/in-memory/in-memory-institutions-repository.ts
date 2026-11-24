import type { Institution } from '@/domain/institution/institution'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'

export class InMemoryInstitutionsRepository implements InstitutionsRepository {
  public items: Institution[] = []

  async findById(id: string) {
    return this.items.find((item) => item.id === id) ?? null
  }

  async findMany() {
    return [...this.items]
  }

  async findManyValidated() {
    return this.items.filter((item) => item.validated)
  }

  async create(institution: Institution) {
    this.items.push(institution)
  }

  async save(institution: Institution) {
    const index = this.items.findIndex((item) => item.id === institution.id)

    if (index >= 0) {
      this.items[index] = institution
    }
  }
}
