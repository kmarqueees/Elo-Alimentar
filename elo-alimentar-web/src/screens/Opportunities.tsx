import { api, type Batch, type RankItem } from '../api'
import { useLoad } from '../hooks'
import { FOOD_ICON, FOOD_LABEL, STORAGE_LABEL, formatHours, hoursLeft, num, points } from '../format'
import type { Session } from '../session'

interface Row { batch: Batch; mine: RankItem | null; total: number }

export function Opportunities({ session, onOpen }: { session: Session; onOpen: (batchId: string) => void }) {
  const { data, error, loading } = useLoad<Row[]>(async () => {
    const batches = (await api.listBatches('AVAILABLE')).sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())

    return Promise.all(
      batches.map(async (batch) => {
        const { ranking } = await api.matches(batch.id, 'multicriteria')

        return { batch, mine: ranking.find((r) => r.institution.id === session.id) ?? null, total: ranking.length }
      }),
    )
  }, [session.id])

  const rows = data ?? []
  const compatible = rows.filter((r) => r.mine).length

  return (
    <section aria-labelledby="t-opp">
      <div className="screen-frame">
        <div className="dash">
          <div className="dash-head">
            <div>
              <h2 id="t-opp" style={{ fontSize: '1.4rem' }}>Oportunidades de doação</h2>
              <p>{loading ? 'Carregando…' : `${compatible} de ${rows.length} lotes são compatíveis com ${session.name}`}</p>
            </div>
          </div>
          {error && <div className="banner error" role="alert">{error}</div>}
          <div className="lote-list">
            {rows.map(({ batch, mine, total }) => {
              const left = hoursLeft(batch.expiresAt)

              return (
                <div className="lote-card" key={batch.id} style={mine ? undefined : { opacity: 0.7 }}>
                  <div className="lote-thumb" role="img" aria-label={FOOD_LABEL[batch.foodType]}>{FOOD_ICON[batch.foodType]}</div>
                  <div className="lote-info">
                    <h4>
                      {FOOD_LABEL[batch.foodType]} — {num(batch.quantityKg)} kg
                      {left < 24 && <span className="urgent-tag">Validade em {formatHours(left)}</span>}
                    </h4>
                    <span>{STORAGE_LABEL[batch.storageCondition]} · vence em {formatHours(left)}</span>
                  </div>
                  <div className="score">
                    {mine ? (
                      <>
                        <b>{points(mine.score)}</b>
                        <span>{mine.position}º de {total} · {num(mine.distanceKm)} km</span>
                      </>
                    ) : (
                      <>
                        <b>—</b>
                        <span>fora das regras do lote</span>
                      </>
                    )}
                  </div>
                  <button className={`btn ${mine ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onOpen(batch.id)}>{mine ? 'Ver e solicitar' : 'Ver detalhes'}</button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
