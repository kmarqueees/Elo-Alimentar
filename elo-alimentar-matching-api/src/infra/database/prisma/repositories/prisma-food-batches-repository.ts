import type { Prisma, PrismaClient } from '@prisma/client'
import { BatchNotAvailableError } from '@/domain/food-batch/errors/batch-not-available-error'
import { InvalidOfferStateError } from '@/domain/food-batch/errors/invalid-offer-state-error'
import type { BatchStatus, FoodBatch } from '@/domain/food-batch/food-batch'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'
import type { OfferStatus } from '@/domain/food-batch/offer'
import {
  includeOffers,
  PrismaFoodBatchMapper,
  PrismaOfferMapper,
  type PrismaFoodBatchWithOffers,
} from '../mappers/prisma-food-batch-mapper'

/** Estado do agregado no momento em que foi lido do banco. */
interface Snapshot {
  status: BatchStatus
  offers: Map<string, OfferStatus>
}

/**
 * Persiste o agregado FoodBatch (lote + ofertas) numa única transação.
 *
 * Concorrência otimista sem coluna extra: cada UPDATE exige que o status no
 * banco ainda seja o que foi lido. Se outra requisição mudou o lote no meio
 * do caminho (ex.: a instituição aceita no instante em que a varredura expira
 * a oferta), o UPDATE não afeta nenhuma linha e a operação falha com erro de
 * negócio, sem sobrescrever.
 */
export class PrismaFoodBatchesRepository implements FoodBatchesRepository {
  private snapshots = new WeakMap<FoodBatch, Snapshot>()

  constructor(private client: PrismaClient) {}

  async findById(id: string) {
    const row = await this.client.foodBatch.findUnique({
      where: { id },
      include: includeOffers,
    })

    return row ? this.load(row) : null
  }

  async findByOfferId(offerId: string) {
    const row = await this.client.foodBatch.findFirst({
      where: { offers: { some: { id: offerId } } },
      include: includeOffers,
    })

    return row ? this.load(row) : null
  }

  async findMany(status?: BatchStatus) {
    return this.findManyWhere(status ? { status } : {})
  }

  async findManyInOfferQueue() {
    return this.findManyWhere({ status: { in: ['AVAILABLE', 'OFFERED'] } })
  }

  async findManyOfferedTo(institutionId: string) {
    return this.findManyWhere({ offers: { some: { institution_id: institutionId } } })
  }

  async create(batch: FoodBatch) {
    await this.client.$transaction(async (tx) => {
      await tx.foodBatch.create({ data: PrismaFoodBatchMapper.toPersistence(batch) })

      for (const offer of batch.offers) {
        await tx.offer.create({ data: PrismaOfferMapper.toPersistence(offer) })
      }
    })

    this.remember(batch)
  }

  async save(batch: FoodBatch) {
    const snapshot = this.snapshots.get(batch)

    await this.client.$transaction(async (tx) => {
      const { count } = await tx.foodBatch.updateMany({
        where: {
          id: batch.id,
          ...(snapshot ? { status: snapshot.status } : {}),
        },
        data: { status: batch.status },
      })

      if (count === 0) {
        throw new BatchNotAvailableError()
      }

      for (const offer of batch.offers) {
        const previousStatus = snapshot?.offers.get(offer.id)

        if (previousStatus === undefined) {
          await tx.offer.create({ data: PrismaOfferMapper.toPersistence(offer) })
          continue
        }

        if (previousStatus === offer.status) {
          continue
        }

        const updated = await tx.offer.updateMany({
          where: { id: offer.id, status: previousStatus },
          data: { status: offer.status, responded_at: offer.respondedAt },
        })

        if (updated.count === 0) {
          throw new InvalidOfferStateError()
        }
      }
    })

    this.remember(batch)
  }

  private async findManyWhere(where: Prisma.FoodBatchWhereInput) {
    const rows = await this.client.foodBatch.findMany({
      where,
      include: includeOffers,
      orderBy: { created_at: 'asc' },
    })

    return rows.map((row) => this.load(row))
  }

  private load(row: PrismaFoodBatchWithOffers) {
    const batch = PrismaFoodBatchMapper.toDomain(row)

    this.remember(batch)

    return batch
  }

  private remember(batch: FoodBatch) {
    this.snapshots.set(batch, {
      status: batch.status,
      offers: new Map(batch.offers.map((offer) => [offer.id, offer.status])),
    })
  }
}
