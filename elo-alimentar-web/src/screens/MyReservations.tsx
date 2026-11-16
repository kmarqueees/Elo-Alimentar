import { api, type Batch, type Reservation } from '../api'
import { useLoad } from '../hooks'
import { FOOD_ICON, FOOD_LABEL, formatDateTime, num, points } from '../format'
import type { Session } from '../session'

const LABEL = { PENDING: 'Aguardando o doador', CONFIRMED: 'Confirmada — retirar', EXPIRED: 'Prazo esgotado', CANCELLED: 'Recusada' } as const

export function MyReservations({ session, onOpen }: { session: Session; onOpen: (batchId: string) => void }) {
  const { data, error, loading } = useLoad<{ batch: Batch; reservation: Reservation }[]>(async () => {
    const batches = await api.listBatches('ALL')
    const lists = await Promise.all(batches.map(async (batch) => (await api.reservations(batch.id)).map((reservation) => ({ batch, reservation }))))

    return lists.flat().filter((x) => x.reservation.institutionId === session.id).sort((a, b) => b.reservation.createdAt.localeCompare(a.reservation.createdAt))
  }, [session.id])

  const rows = data ?? []

  return (
    <section aria-labelledby="t-res">
      <div className="screen-frame">
        <div className="dash">
          <div className="dash-head">
            <div>
              <h2 id="t-res" style={{ fontSize: '1.4rem' }}>Minhas solicitações</h2>
              <p>{loading ? 'Carregando…' : `${rows.length} solicitação(ões) de ${session.name}`}</p>
            </div>
          </div>
          {error && <div className="banner error" role="alert">{error}</div>}
          {!loading && !error && rows.length === 0 && <div className="empty">Você ainda não solicitou nenhum lote. Veja as oportunidades de doação.</div>}
          <div className="lote-list">
            {rows.map(({ batch, reservation }) => (
              <div className="lote-card" key={reservation.id}>
                <div className="lote-thumb" role="img" aria-label={FOOD_LABEL[batch.foodType]}>{FOOD_ICON[batch.foodType]}</div>
                <div className="lote-info">
                  <h4>{FOOD_LABEL[batch.foodType]} — {num(batch.quantityKg)} kg <span className={`status-tag ${reservation.status === 'CONFIRMED' ? 'collected' : 'reserved'}`}>{LABEL[reservation.status]}</span></h4>
                  <span>Solicitado em {formatDateTime(reservation.createdAt)}</span>
                </div>
                <div className="score"><b>{points(reservation.score)}</b><span>pontuação</span></div>
                <button className="btn btn-ghost" onClick={() => onOpen(batch.id)}>Abrir</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
