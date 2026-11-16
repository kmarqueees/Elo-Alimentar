import { randomUUID } from 'node:crypto'
import type { Institution } from '@/matching/types'
import type {
  CreateInstitutionData,
  InstitutionsRepository,
} from '../institutions-repository'

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

  async create(data: CreateInstitutionData) {
    const institution: Institution = {
      ...data,
      id: data.id ?? randomUUID(),
    }

    this.items.push(institution)

    return institution
  }

  async validate(id: string) {
    const institution = this.items.find((item) => item.id === id)

    if (!institution) {
      return null
    }

    institution.validated = true

    return institution
  }
}
