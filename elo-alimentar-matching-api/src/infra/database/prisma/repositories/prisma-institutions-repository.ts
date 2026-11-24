import type { PrismaClient } from '@prisma/client'
import type { Institution } from '@/domain/institution/institution'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'
import { PrismaInstitutionMapper } from '../mappers/prisma-institution-mapper'

export class PrismaInstitutionsRepository implements InstitutionsRepository {
  constructor(private client: PrismaClient) {}

  async findById(id: string) {
    const row = await this.client.institution.findUnique({ where: { id } })

    return row ? PrismaInstitutionMapper.toDomain(row) : null
  }

  async findMany() {
    const rows = await this.client.institution.findMany({
      orderBy: { created_at: 'asc' },
    })

    return rows.map(PrismaInstitutionMapper.toDomain)
  }

  async findManyValidated() {
    const rows = await this.client.institution.findMany({
      where: { validated: true },
      orderBy: { created_at: 'asc' },
    })

    return rows.map(PrismaInstitutionMapper.toDomain)
  }

  async create(institution: Institution) {
    await this.client.institution.create({
      data: PrismaInstitutionMapper.toPersistence(institution),
    })
  }

  async save(institution: Institution) {
    const { id, ...data } = PrismaInstitutionMapper.toPersistence(institution)

    await this.client.institution.update({ where: { id: id! }, data })
  }
}
