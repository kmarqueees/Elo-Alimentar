import type { Institution } from './institution'

export interface InstitutionsRepository {
  findById(id: string): Promise<Institution | null>
  findMany(): Promise<Institution[]>
  findManyValidated(): Promise<Institution[]>
  create(institution: Institution): Promise<void>
  save(institution: Institution): Promise<void>
}
