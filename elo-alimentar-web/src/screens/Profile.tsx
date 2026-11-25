import { useState } from 'react'
import { api, ApiError, type Institution } from '../api'
import { useLoad } from '../hooks'
import { FOOD_LABEL, formatDateTime, num } from '../format'
import type { Session } from '../session'

export function Profile({ session }: { session: Session }) {
  const { data: institutions, reload } = useLoad(
    () => (session.role === 'institution' ? api.listInstitutions() : Promise.resolve([] as Institution[])),
    [session.id],
  )
  const inst = institutions?.find((i) => i.id === session.id)

  return (
    <section aria-labelledby="t-profile">
      <div className="screen-frame">
        <div className="profile">
          <div>
            <div className="avatar" aria-hidden="true">{session.name[0]}</div>
            <p style={{ marginTop: 12 }}><span className={`role ${session.role === 'donor' ? 'donor' : ''}`}>{session.role === 'donor' ? 'Doador' : 'Instituição'}</span></p>
          </div>
          <div>
            <h2 id="t-profile" style={{ fontSize: '1.5rem' }}>{session.name}</h2>

            {session.role === 'institution' && inst && (
              <StockPanel institution={inst} onUpdated={() => void reload(true)} />
            )}

            <dl>
              {session.role === 'donor' ? (
                <>
                  <dt>Tipo de conta</dt><dd>Doador (comércio / produtor)</dd>
                </>
              ) : (
                <>
                  <dt>Tipo de conta</dt><dd>Instituição receptora</dd>
                  <dt>Situação</dt><dd>{inst ? (inst.validated ? 'Validada pelo administrador' : 'Aguardando validação') : '—'}</dd>
                  <dt>Pessoas atendidas</dt><dd>{inst ? (inst.peopleServed > 0 ? `${num(inst.peopleServed)} por dia` : 'Não informado') : '—'}</dd>
                  <dt>Refrigeração</dt><dd>{inst ? (inst.hasRefrigeration ? 'Sim' : 'Não') : '—'}</dd>
                  <dt>Capacidade de armazenamento</dt><dd>{inst ? `${num(inst.storageCapacityKg)} kg` : '—'}</dd>
                  <dt>Aceita</dt><dd>{inst ? (inst.acceptedFoodTypes.length ? inst.acceptedFoodTypes.map((t) => FOOD_LABEL[t]).join(', ') : 'Todos os tipos') : '—'}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Estoque da instituição. O sistema estima sozinho (desconta o consumo diário e
 * soma as doações retiradas); a instituição corrige informando o valor real.
 */
function StockPanel({ institution, onUpdated }: { institution: Institution; onUpdated: () => void }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const days = institution.stockDays
  const level = days === null ? 'unknown' : days <= 1 ? 'low' : days < 3 ? 'medium' : 'ok'

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const stockKg = Number(value.replace(',', '.'))

    if (value.trim() === '' || Number.isNaN(stockKg)) {
      setMessage({ ok: false, text: 'Informe o estoque em quilos.' })
      return
    }

    setBusy(true)
    setMessage(null)

    try {
      await api.updateStock(institution.id, stockKg)
      setValue('')
      setMessage({ ok: true, text: 'Estoque atualizado.' })
      onUpdated()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Algo deu errado.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`stock-panel ${level}`}>
      <div className="stock-summary">
        <div>
          <span className="eyebrow">Estoque estimado</span>
          <p className="stock-kg">{num(institution.estimatedStockKg)} kg</p>
        </div>
        <div>
          <span className="eyebrow">Dura cerca de</span>
          <p className="stock-kg">{days === null ? '—' : days < 1 ? 'menos de 1 dia' : `${num(days)} dia(s)`}</p>
        </div>
        <div>
          <span className="eyebrow">Consumo</span>
          <p className="stock-kg">{num(institution.dailyConsumptionKg)} kg/dia</p>
        </div>
      </div>

      <p className="hint">
        Calculado a partir do último estoque informado ({formatDateTime(institution.stockUpdatedAt)}), descontando o
        consumo diário e somando as doações retiradas. Quanto menos dias o estoque durar, mais prioridade sua instituição
        recebe nas ofertas.
      </p>

      <form className="stock-form" onSubmit={save}>
        <div className="field">
          <label htmlFor="estoque">Informar estoque atual (kg)</label>
          <input id="estoque" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="ex.: 120" />
        </div>
        <button className="btn btn-forest" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Atualizar estoque'}</button>
      </form>

      {message && <div className={`banner ${message.ok ? 'ok' : 'error'}`} role={message.ok ? 'status' : 'alert'}>{message.text}</div>}
    </div>
  )
}
