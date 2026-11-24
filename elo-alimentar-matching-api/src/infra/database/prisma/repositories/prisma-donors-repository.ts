import type { PrismaClient } from '@prisma/client'
import type { DonorsRepository } from '@/domain/donor/donors-repository'

export class PrismaDonorsRepository implements DonorsRepository {
  constructor(private client: PrismaClient) {}

  async exists(donorId: string) {
    const count = await this.client.user.count({ where: { id: donorId } })

    return count > 0
  }
}
