import { api, type Batch } from '../api'
import { useLoad } from '../hooks'
import { FOOD_ICON, FOOD_LABEL, STATUS_LABEL, STORAGE_LABEL, formatDateTime, formatHours, hoursLeft, num, points } from '../format'

interface LotsProps {
  onOpen: (batchId: string) => void
  onNew?: () => void
  donorId?: string
  title?: string
}

const ORDER = { AVAILABLE: 0, RESERVED: 1, COLLECTED: 2, EXPIRED: 3 } as const

export function Lots({ onOpen, onNew, donorId, title = 'Doações cadastradas' }: LotsProps) {
  const { data, error, loading } = useLoad(async () => {
    const batches = (await api.listBatches('ALL')).filter((b) => !donorId || b.donorId === donorId).sort(
      (a, b) => ORDER[a.status] - ORDER[b.status] || new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
    )

    const best: Record<string, number | null> = {}

    await Promise.all(
      batches
        .filter((b) => b.status === 'AVAILABLE')
        .map(async (b) => {
          try {
            const { ranking } = await api.matches(b.id, 'multicriteria')

            best[b.id] = ranking[0] ? ranking[0].score : null
          } catch {
            best[b.id] = null
          }
        }),
    )

    return { batches, best }
  }, [donorId])

  const batches = data?.batches ?? []
  const available = batches.filter((b) => b.status === 'AVAILABLE').length
  const reserved = batches.filter((b) => b.status === 'RESERVED').length

  return (
    <section aria-labelledby="t-lots">
      <div className="screen-frame">
        <div className="dash">
          <div className="dash-head">
            <div>
              <h2 id="t-lots" style={{ fontSize: '1.4rem' }}>{title}</h2>
              <p>{loading ? 'Carregando…' : `${available} disponíveis · ${reserved} reservados · ${batches.length} no total`}</p>
            </div>
            {onNew && <button className="btn btn-primary" onClick={onNew}>+ Cadastrar novo lote</button>}
          </div>

          {error && <div className="banner error" role="alert">{error}</div>}
          {!loading && !error && batches.length === 0 && <div className="empty">Nenhum lote cadastrado ainda.</div>}

          <div className="lote-list">
            {batches.map((b) => (
              <LotCard key={b.id} batch={b} best={data?.best[b.id]} onOpen={() => onOpen(b.id)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function LotCard({ batch, best, onOpen }: { batch: Batch; best: number | null | undefined; onOpen: () => void }) {
  const left = hoursLeft(batch.expiresAt)
  const urgent = batch.status === 'AVAILABLE' && left > 0 && left < 24

  return (
    <div className="lote-card">
      <div className="lote-thumb" role="img" aria-label={FOOD_LABEL[batch.foodType]}>{FOOD_ICON[batch.foodType]}</div>
      <div className="lote-info">
        <h4>
          {FOOD_LABEL[batch.foodType]} — {num(batch.quantityKg)} kg
          {urgent && <span className="urgent-tag">Validade em {formatHours(left)}</span>}
          <span className={`status-tag ${batch.status === 'RESERVED' ? 'reserved' : batch.status === 'COLLECTED' ? 'collected' : ''}`}>
            {STATUS_LABEL[batch.status]}
          </span>
        </h4>
        <span>{STORAGE_LABEL[batch.storageCondition]} · vence em {formatHours(left)} ({formatDateTime(batch.expiresAt)})</span>
      </div>
      <div className="score">
        {batch.status === 'AVAILABLE' ? (
          <>
            <b>{best === undefined ? '…' : best === null ? '—' : points(best)}</b>
            <span>{best === null ? 'sem instituição viável' : 'melhor pontuação'}</span>
          </>
        ) : (
          <>
            <b>{STATUS_LABEL[batch.status]}</b>
            <span>status do lote</span>
          </>
        )}
      </div>
      <button className="btn btn-ghost" onClick={onOpen}>Ver detalhes</button>
    </div>
  )
}
