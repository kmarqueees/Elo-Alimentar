import type { FoodBatch } from '../food-batch/food-batch'

interface Commitment {
  institutionId: string
  kg: number
}

/**
 * Lotes que cada instituição já tem "em aberto": ofertas pendentes ou aceitas
 * e ainda não retiradas. Usado para limitar quantos lotes uma instituição
 * recebe ao mesmo tempo e quanto espaço de armazenamento já está reservado.
 *
 * É um retrato (read model) montado a partir dos lotes; quem faz várias
 * ofertas em sequência deve chamar `track` após cada uma.
 */
export class InstitutionWorkload {
  private commitments = new Map<string, Commitment>()

  static fromBatches(batches: readonly FoodBatch[]) {
    const workload = new InstitutionWorkload()

    for (const batch of batches) {
      workload.track(batch)
    }

    return workload
  }

  /** Atualiza o compromisso deste lote conforme o estado atual dele. */
  track(batch: FoodBatch) {
    this.commitments.delete(batch.id)

    const offer = batch.activeOffer
    const open = batch.status === 'OFFERED' || batch.status === 'RESERVED'

    if (offer && open) {
      this.commitments.set(batch.id, { institutionId: offer.institutionId, kg: batch.quantityKg })
    }
  }

  /** Quantos lotes a instituição tem em aberto (ignorando `exceptBatchId`). */
  openCount(institutionId: string, exceptBatchId?: string) {
    return this.entriesOf(institutionId, exceptBatchId).length
  }

  /** Quantos kg já estão comprometidos com a instituição (ignorando `exceptBatchId`). */
  committedKg(institutionId: string, exceptBatchId?: string) {
    return this.entriesOf(institutionId, exceptBatchId).reduce((sum, item) => sum + item.kg, 0)
  }

  private entriesOf(institutionId: string, exceptBatchId?: string) {
    return [...this.commitments.entries()]
      .filter(([batchId, item]) => item.institutionId === institutionId && batchId !== exceptBatchId)
      .map(([, item]) => item)
  }
}
