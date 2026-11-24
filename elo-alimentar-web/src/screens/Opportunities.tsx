import { useEffect, useState } from 'react'
import { api, ApiError, type InstitutionOffer } from '../api'
import { useLoad, useNow } from '../hooks'
import { FOOD_ICON, FOOD_LABEL, STORAGE_LABEL, formatCountdown, formatHours, hoursLeft, num } from '../format'
import type { Session } from '../session'

/**
 * Ofertas para a instituição. Na oferta sequencial ela não procura lotes:
 * o sistema oferece um lote por vez, na ordem do ranking, e ela tem um prazo
 * para aceitar ou recusar. Ela não vê a própria posição nem outras instituições.
 */
export function Opportunities({ session, onOpen }: { session: Session; onOpen: (batchId: string) => void }) {
  const now = useNow()
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, error, loading, reload } = useLoad<InstitutionOffer[]>(
    async () => (await api.institutionOffers(session.id)).filter(({ offer }) => offer.status === 'PENDING'),
    [session.id],
  )

  // Novas ofertas chegam pela fila do servidor: atualiza sozinho.
  useEffect(() => {
    const id = setInterval(() => void reload(true), 5000)

    return () => clearInterval(id)
  }, [reload])

  async function respond(offerId: string, action: 'accept' | 'decline') {
    setBusy(offerId)
    setNotice(null)
    setActionError(null)

    try {
      await (action === 'accept' ? api.accept(offerId, session.id) : api.decline(offerId, session.id))
      setNotice(
        action === 'accept'
          ? 'Oferta aceita! Combine a retirada e registre-a em “Minhas retiradas”.'
          : 'Oferta recusada. O lote seguiu para a próxima instituição.',
      )
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Algo deu errado.')
    } finally {
      setBusy(null)
      await reload(true)
    }
  }

  const rows = data ?? []

  return (
    <section aria-labelledby="t-opp">
      <div className="screen-frame">
        <div className="dash">
          <div className="dash-head">
            <div>
              <h2 id="t-opp" style={{ fontSize: '1.4rem' }}>Ofertas para você</h2>
              <p>
                {loading
                  ? 'Carregando…'
                  : rows.length === 0
                    ? `Nenhuma oferta aguardando ${session.name} no momento.`
                    : `${rows.length} oferta(s) aguardando a resposta de ${session.name}`}
              </p>
            </div>
          </div>

          <div className="banner info">
            Os lotes são oferecidos <b>a uma instituição por vez</b>, na ordem de compatibilidade. Responda dentro do
            prazo: se recusar ou o tempo acabar, o lote segue para a próxima instituição.
          </div>

          {error && <div className="banner error" role="alert">{error}</div>}
          {actionError && <div className="banner error" role="alert">{actionError}</div>}
          {notice && <div className="banner ok" role="status">{notice}</div>}
          {!loading && !error && rows.length === 0 && (
            <div className="empty">Quando um lote compatível com a sua instituição for cadastrado, ele aparece aqui.</div>
          )}

          <div className="lote-list">
            {rows.map(({ offer, batch }) => {
              const left = hoursLeft(batch.expiresAt, now)
              const remaining = new Date(offer.expiresAt).getTime() - now
              const closed = remaining <= 0

              return (
                <div className="lote-card" key={offer.id}>
                  <div className="lote-thumb" role="img" aria-label={FOOD_LABEL[batch.foodType]}>{FOOD_ICON[batch.foodType]}</div>
                  <div className="lote-info">
                    <h4>
                      {FOOD_LABEL[batch.foodType]} — {num(batch.quantityKg)} kg
                      {left < 24 && <span className="urgent-tag">Validade em {formatHours(left)}</span>}
                    </h4>
                    <span>{STORAGE_LABEL[batch.storageCondition]} · vence em {formatHours(left)}</span>
                  </div>
                  <div className="score">
                    <b className="countdown">{closed ? 'encerrado' : formatCountdown(remaining)}</b>
                    <span>para responder</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-forest btn-sm" disabled={busy !== null || closed} onClick={() => respond(offer.id, 'accept')}>
                      Aceitar
                    </button>
                    <button className="btn btn-danger btn-sm" disabled={busy !== null || closed} onClick={() => respond(offer.id, 'decline')}>
                      Recusar
                    </button>
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
