import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type Batch, type Institution, type MatchesResponse, type RankItem, type Reservation } from '../api'
import { MapView, type MapMarker } from '../components/MapView'
import { RankCard } from '../components/RankCard'
import { useLoad, useNow } from '../hooks'
import type { Session } from '../session'
import {
  FOOD_ICON, FOOD_LABEL, STATUS_LABEL, STORAGE_LABEL,
  formatCountdown, formatDateTime, formatHours, hoursLeft, num, points,
} from '../format'

interface MatchingProps {
  batchId: string | null
  onSelect: (batchId: string) => void
  session: Session
}

type View = 'both' | 'multi' | 'base'

interface Loaded {
  batches: Batch[]
  institutions: Institution[]
  batch: Batch | null
  reservations: Reservation[]
  multi: MatchesResponse | null
  base: MatchesResponse | null
}

function whyOut(batch: Batch, institution: Institution, hours: number, item?: RankItem) {
  if (batch.storageCondition !== 'DRY' && !institution.hasRefrigeration) return 'sem refrigeração'
  if (item && item.travelMinutes / 60 >= hours) return 'chegaria depois do vencimento'
  if (item && item.distanceKm > 15) return 'fora do raio de 15 km'

  return 'não atende às regras do lote'
}

export function Matching({ batchId, onSelect, session }: MatchingProps) {
  const [view, setView] = useState<View>('both')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const now = useNow()

  const { data, error, loading, reload } = useLoad<Loaded>(async () => {
    const [all, institutions] = await Promise.all([api.listBatches('ALL'), api.listInstitutions()])
    const batches = session.role === 'donor' ? all.filter((b) => b.donorId === session.id) : all
    const chosen =
      batches.find((b) => b.id === batchId) ?? batches.find((b) => b.status === 'AVAILABLE') ?? batches[0] ?? null

    if (!chosen) return { batches, institutions, batch: null, reservations: [], multi: null, base: null }

    const reservations = await api.reservations(chosen.id)

    if (chosen.status !== 'AVAILABLE') {
      return { batches, institutions, batch: chosen, reservations, multi: null, base: null }
    }

    const [multi, base] = await Promise.all([api.matches(chosen.id, 'multicriteria'), api.matches(chosen.id, 'distance')])

    return { batches, institutions, batch: chosen, reservations, multi, base }
  }, [batchId, session.id])

  const batch = data?.batch ?? null
  const active = data?.reservations.find((r) => r.status === 'PENDING' || r.status === 'CONFIRMED') ?? null
  const history = data?.reservations.filter((r) => r.status === 'CANCELLED' || r.status === 'EXPIRED') ?? []
  const nameOf = (id: string) => data?.institutions.find((i) => i.id === id)?.name ?? 'Instituição'

  useEffect(() => {
    if (batch?.status !== 'RESERVED') return
    const id = setInterval(() => void reload(true), 4000)

    return () => clearInterval(id)
  }, [batch?.status, reload])

  async function act(action: () => Promise<unknown>, message?: string) {
    setBusy(true)
    setActionError(null)
    setNotice(null)

    try {
      await action()
      await reload(true)
      if (message) setNotice(message)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Algo deu errado.')
      await reload(true)
    } finally {
      setBusy(false)
    }
  }

  const markers = useMemo<MapMarker[]>(() => {
    if (!data || !batch) return []

    const hours = data.multi?.hoursUntilExpiry ?? hoursLeft(batch.expiresAt)
    const rankedIds = new Map((data.multi?.ranking ?? []).map((r) => [r.institution.id, r.position]))
    const result: MapMarker[] = [
      { lat: batch.latitude, lng: batch.longitude, text: FOOD_ICON[batch.foodType], kind: 'batch', tooltip: 'Local de retirada do lote' },
    ]

    for (const inst of data.institutions) {
      const position = rankedIds.get(inst.id)
      const isReserved = active?.institutionId === inst.id

      if (position !== undefined) {
        result.push({ lat: inst.latitude, lng: inst.longitude, text: String(position), kind: position === 1 ? 'first' : 'ranked', tooltip: `${position}º · ${inst.name}` })
      } else if (isReserved) {
        result.push({ lat: inst.latitude, lng: inst.longitude, text: '✓', kind: 'first', tooltip: `${inst.name} (reserva)` })
      } else {
        result.push({ lat: inst.latitude, lng: inst.longitude, text: '–', kind: 'off', tooltip: `${inst.name} — fora do ranking: ${whyOut(batch, inst, hours)}` })
      }
    }

    return result
  }, [data, batch, active])

  const picker = (
    <div className="picker">
      <div className="field">
        <label htmlFor="lote">Lote</label>
        <select id="lote" value={batch?.id ?? ''} onChange={(e) => onSelect(e.target.value)}>
          {(data?.batches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {FOOD_LABEL[b.foodType]} · {num(b.quantityKg)} kg · {STORAGE_LABEL[b.storageCondition]} · {STATUS_LABEL[b.status]} · vence em {formatHours(hoursLeft(b.expiresAt, now))}
            </option>
          ))}
        </select>
      </div>
      {batch?.status === 'AVAILABLE' && (
        <div className="segmented" role="group" aria-label="Visualização do ranking">
          <button aria-pressed={view === 'both'} onClick={() => setView('both')}>Comparar lado a lado</button>
          <button aria-pressed={view === 'multi'} onClick={() => setView('multi')}>Multicritério</button>
          <button aria-pressed={view === 'base'} onClick={() => setView('base')}>Somente distância</button>
        </div>
      )}
    </div>
  )

  return (
    <section aria-labelledby="t-match">
      <div className="screen-frame">
        <div className="results">
          <h2 id="t-match" style={{ fontSize: '1.5rem' }}>Delhates do lote</h2>
          

          {picker}

          {error && <div className="banner error" role="alert">{error}</div>}
          {loading && !data && <p>Carregando…</p>}
          {!loading && data && !batch && <div className="empty">Não há lotes. Cadastre um lote para ver o matching.</div>}
          {actionError && <div className="banner error" role="alert">{actionError}</div>}
          {notice && <div className="banner ok" role="status">{notice}</div>}

          {data && batch && (
            <>
              <div className="summary">
                <h3>{FOOD_ICON[batch.foodType]} {FOOD_LABEL[batch.foodType]} — {num(batch.quantityKg)} kg</h3>
                <span className={`chip ${hoursLeft(batch.expiresAt, now) < 24 ? 'warn' : ''}`}>Validade em {formatHours(hoursLeft(batch.expiresAt, now))}</span>
                <span className="chip">{STORAGE_LABEL[batch.storageCondition]}</span>
                <span className="chip amber">{STATUS_LABEL[batch.status]}</span>
              </div>

              <MapView markers={markers} height="tall" label="Mapa do lote e das instituições" />
              <div className="map-legend" aria-hidden="true">
                <span><i style={{ background: 'var(--berry)' }} />Lote</span>
                <span><i style={{ background: 'var(--mango)' }} />1ª do ranking</span>
                <span><i style={{ background: 'var(--forest)' }} />Demais no ranking</span>
                <span><i style={{ background: '#A9A596' }} />Fora do ranking</span>
              </div>

              <div style={{ height: 22 }} />

              {batch.status !== 'AVAILABLE' && (
                <ReservationPanel
                  batch={batch}
                  reservation={active}
                  nameOf={nameOf}
                  now={now}
                  busy={busy}
                  role={session.role}
                  myId={session.id}
                  onConfirm={(id) => act(() => api.confirm(id), 'Solicitação aceita pelo doador. Falta a retirada.')}
                  onReject={(id) => act(() => api.reject(id), 'Recusada. O lote voltou a ficar disponível e a próxima instituição do ranking é sugerida.')}
                  onPickup={(id) => act(() => api.pickup(id), 'Retirada registrada.')}
                />
              )}

              {history.length > 0 && (
                <ul className="history" aria-label="Instituições já tentadas neste lote">
                  {history.map((r) => (
                    <li key={r.id}>
                      ↩ <b>{nameOf(r.institutionId)}</b> — {r.status === 'CANCELLED' ? 'recusada pelo doador' : 'prazo de confirmação expirou'}; saiu do ranking deste lote.
                    </li>
                  ))}
                </ul>
              )}

              {batch.status === 'AVAILABLE' && data.multi && data.base && (
                <Rankings
                  view={view}
                  batch={batch}
                  multi={data.multi}
                  base={data.base}
                  institutions={data.institutions}
                  hadAttempts={history.length > 0}
                  busy={busy}
                  role={session.role}
                  myId={session.id}
                  onReserve={(institutionId) =>
                    act(() => api.reserve(batch.id, institutionId), 'Lote solicitado. Agora o doador precisa aceitar dentro do prazo.')
                  }
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function Rankings({
  view, batch, multi, base, institutions, hadAttempts, busy, role, myId, onReserve,
}: {
  view: View
  batch: Batch
  multi: MatchesResponse
  base: MatchesResponse
  institutions: Institution[]
  hadAttempts: boolean
  busy: boolean
  role: Session['role']
  myId: string
  onReserve: (institutionId: string) => void
}) {
  const viable = new Set(multi.ranking.map((r) => r.institution.id))
  const byId = new Map(institutions.map((i) => [i.id, i]))
  const problemOf = (item: RankItem) => {
    if (viable.has(item.institution.id)) return undefined
    const inst = byId.get(item.institution.id)

    return inst ? whyOut(batch, inst, multi.hoursUntilExpiry, item) : 'não atende às regras do lote'
  }
  const firstBase = base.ranking[0]
  const firstBaseProblem = firstBase ? problemOf(firstBase) : undefined

  const multiColumn = (
    <div className="col-card">
      <h3>Multicritério <span className="chip">Elo Alimentar</span></h3>
      <p className="sub">Proximidade + urgência + compatibilidade, com filtros eliminatórios.</p>
      {multi.ranking.length > 0 && <p className="verdict good">✓ Todas as indicações passam nos filtros de refrigeração, raio e validade.</p>}
      {multi.ranking.length === 0 && (
        <div className="empty">
          {hadAttempts ? 'Todas as instituições viáveis já foram tentadas neste lote.' : 'Nenhuma instituição viável para este lote.'}
        </div>
      )}
      {multi.ranking.map((item) => (
        <RankCard
          key={item.institution.id}
          item={item}
          detailed
          action={
            role === 'institution' && item.institution.id === myId ? (
              <button className="btn btn-forest btn-sm" disabled={busy} onClick={() => onReserve(item.institution.id)}>
                Solicitar este lote
              </button>
            ) : undefined
          }
        />
      ))}
    </div>
  )

  const baseColumn = (
    <div className="col-card base">
      <h3>Somente distância <span className="chip">baseline</span></h3>
      <p className="sub">Ordena só pela proximidade. Ignora refrigeração, validade e capacidade.</p>
      {firstBase && (
        <p className={`verdict ${firstBaseProblem ? 'bad' : 'good'}`}>
          {firstBaseProblem
            ? `⚠ A 1ª indicação por distância é inviável: ${firstBaseProblem}.`
            : '✓ A 1ª indicação por distância é viável neste lote.'}
        </p>
      )}
      {base.ranking.length === 0 && <div className="empty">Nenhuma instituição disponível.</div>}
      {base.ranking.map((item) => (
        <RankCard key={item.institution.id} item={item} detailed={false} problem={problemOf(item)} />
      ))}
    </div>
  )

  return (
    <div className={`compare ${view === 'both' ? '' : 'single'}`}>
      {view !== 'base' && multiColumn}
      {view !== 'multi' && baseColumn}
    </div>
  )
}

function ReservationPanel({
  batch, reservation, nameOf, now, busy, role, myId, onConfirm, onReject, onPickup,
}: {
  batch: Batch
  reservation: Reservation | null
  nameOf: (id: string) => string
  now: number
  busy: boolean
  role: Session['role']
  myId: string
  onConfirm: (id: string) => void
  onReject: (id: string) => void
  onPickup: (id: string) => void
}) {
  if (batch.status === 'EXPIRED') {
    return <div className="banner info">Este lote expirou e saiu das buscas.</div>
  }

  if (!reservation) {
    return batch.status === 'COLLECTED' ? <div className="banner ok">✓ Lote retirado.</div> : null
  }

  const confirmed = reservation.status === 'CONFIRMED'
  const collected = batch.status === 'COLLECTED'
  const remaining = new Date(reservation.expiresAt).getTime() - now

  return (
    <div className="reservation">
      <h3>{collected ? 'Lote retirado ✓' : confirmed ? 'Aceito pelo doador' : 'Aguardando o doador'}</h3>
      <p style={{ margin: 0 }}>
        <b>{nameOf(reservation.institutionId)}</b> · pontuação {points(reservation.score)} · solicitado em {formatDateTime(reservation.createdAt)}
      </p>

      <ol className="timeline" aria-label="Etapas da doação">
        <li className="done">Solicitado pela instituição</li>
        <li className={confirmed || collected ? 'done' : 'now'}>Aceito pelo doador</li>
        <li className={collected ? 'done' : confirmed ? 'now' : ''}>Retirado</li>
      </ol>

      {!confirmed && !collected && (
        <>
          <p style={{ margin: '0 0 12px' }}>
            Prazo para o doador aceitar:{' '}
            <span className="countdown">{remaining > 0 ? formatCountdown(remaining) : 'encerrado'}</span>
            {remaining <= 0 && ' — liberando o lote para a próxima instituição…'}
          </p>
          {role === 'donor' ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-forest" disabled={busy || remaining <= 0} onClick={() => onConfirm(reservation.id)}>
              Aceitar solicitação
            </button>
            <button className="btn btn-danger" disabled={busy || remaining <= 0} onClick={() => onReject(reservation.id)}>
              Recusar
            </button>
          </div>
          ) : <p className="banner info">Aguardando a resposta do doador.</p>}
          <p className="hint" style={{ marginTop: 12, color: 'var(--muted-2)', fontSize: '.8rem' }}>
            Se o doador recusar ou não responder no prazo, o lote volta ao ranking sem esta instituição e a próxima é sugerida.
          </p>
        </>
      )}

      {confirmed && !collected && role === 'institution' && reservation.institutionId === myId && (
        <button className="btn btn-forest" disabled={busy} onClick={() => onPickup(reservation.id)}>
          Registrar retirada
        </button>
      )}
    </div>
  )
}
