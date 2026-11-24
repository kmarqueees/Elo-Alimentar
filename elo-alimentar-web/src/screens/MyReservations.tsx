import { useState } from 'react'
import { api, ApiError, type InstitutionOffer } from '../api'
import { useLoad } from '../hooks'
import { FOOD_ICON, FOOD_LABEL, OFFER_LABEL, STATUS_LABEL, formatDateTime, num } from '../format'
import type { Session } from '../session'

/** Histórico de ofertas da instituição e registro das retiradas. */
export function MyReservations({ session, onOpen }: { session: Session; onOpen: (batchId: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, error, loading, reload } = useLoad<InstitutionOffer[]>(
    async () => (await api.institutionOffers(session.id)).filter(({ offer }) => offer.status !== 'PENDING'),
    [session.id],
  )

  async function pickup(offerId: string) {
    setBusy(true)
    setNotice(null)
    setActionError(null)

    try {
      await api.pickup(offerId, session.id)
      setNotice('Retirada registrada. Obrigado!')
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Algo deu errado.')
    } finally {
      setBusy(false)
      await reload(true)
    }
  }

  const rows = data ?? []

  return (
    <section aria-labelledby="t-res">
      <div className="screen-frame">
        <div className="dash">
          <div className="dash-head">
            <div>
              <h2 id="t-res" style={{ fontSize: '1.4rem' }}>Minhas retiradas</h2>
              <p>{loading ? 'Carregando…' : `${rows.length} oferta(s) já respondida(s) por ${session.name}`}</p>
            </div>
          </div>
          {error && <div className="banner error" role="alert">{error}</div>}
          {actionError && <div className="banner error" role="alert">{actionError}</div>}
          {notice && <div className="banner ok" role="status">{notice}</div>}
          {!loading && !error && rows.length === 0 && (
            <div className="empty">Nenhuma oferta respondida ainda. As ofertas novas aparecem em “Ofertas para você”.</div>
          )}
          <div className="lote-list">
            {rows.map(({ batch, offer }) => {
              const toPickUp = offer.status === 'ACCEPTED' && batch.status === 'RESERVED'
              const label = offer.status === 'ACCEPTED' ? STATUS_LABEL[batch.status] : OFFER_LABEL[offer.status]

              return (
                <div className="lote-card" key={offer.id}>
                  <div className="lote-thumb" role="img" aria-label={FOOD_LABEL[batch.foodType]}>{FOOD_ICON[batch.foodType]}</div>
                  <div className="lote-info">
                    <h4>
                      {FOOD_LABEL[batch.foodType]} — {num(batch.quantityKg)} kg{' '}
                      <span className={`status-tag ${batch.status === 'COLLECTED' ? 'collected' : toPickUp ? 'reserved' : ''}`}>{label}</span>
                    </h4>
                    <span>Oferecido em {formatDateTime(offer.createdAt)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {toPickUp && (
                      <button className="btn btn-forest btn-sm" disabled={busy} onClick={() => pickup(offer.id)}>
                        Registrar retirada
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => onOpen(batch.id)}>Detalhes</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
