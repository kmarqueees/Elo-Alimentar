import type { Institution } from '@/matching/types'

export type CreateInstitutionData = Omit<Institution, 'id'> & { id?: string }

export interface InstitutionsRepository {
  findById(id: string): Promise<Institution | null>
  findMany(): Promise<Institution[]>
  findManyValidated(): Promise<Institution[]>
  create(data: CreateInstitutionData): Promise<Institution>
  validate(id: string): Promise<Institution | null>
}
