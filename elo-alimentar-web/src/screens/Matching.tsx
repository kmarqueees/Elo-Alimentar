import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type Batch, type Institution, type InstitutionOffer, type Offer, type RankItem } from '../api'
import { MapView, type MapMarker } from '../components/MapView'
import { useLoad, useNow } from '../hooks'
import { donorName, type Session } from '../session'
import {
  FOOD_ICON, FOOD_LABEL, OFFER_LABEL, STATUS_LABEL, STORAGE_LABEL,
  distanceKm, formatCountdown, formatDateTime, formatDateTimeLong, formatHours, hoursLeft, num,
} from '../format'

interface MatchingProps {
  batchId: string | null
  onSelect: (batchId: string) => void
  session: Session
}

interface Loaded {
  batches: Batch[]
  institutions: Institution[]
  batch: Batch | null
  /** Doador: todas as ofertas do lote. */
  offers: Offer[]
  /** Doador: próximas instituições da fila (ainda não receberam a oferta). */
  upcoming: RankItem[]
  /** Instituição: só a oferta que ela recebeu deste lote. */
  myOffer: InstitutionOffer['offer'] | null
}

const IN_QUEUE: Batch['status'][] = ['AVAILABLE', 'OFFERED']

export function Matching({ batchId, onSelect, session }: MatchingProps) {
  const isDonor = session.role === 'donor'
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const now = useNow()

  const { data, error, loading, reload } = useLoad<Loaded>(async () => {
    const institutions = await api.listInstitutions()
    const empty = { offers: [], upcoming: [], myOffer: null }

    if (!isDonor) {
      const received = await api.institutionOffers(session.id)
      const chosen = received.find((item) => item.batch.id === batchId) ?? received[0] ?? null

      return {
        ...empty,
        batches: received.map((item) => item.batch),
        institutions,
        batch: chosen?.batch ?? null,
        myOffer: chosen?.offer ?? null,
      }
    }

    const batches = (await api.listBatches('ALL')).filter((b) => b.donorId === session.id)
    const chosen = batches.find((b) => b.id === batchId) ?? batches.find((b) => IN_QUEUE.includes(b.status)) ?? batches[0] ?? null

    if (!chosen) return { ...empty, batches, institutions, batch: null }

    const offers = await api.batchOffers(chosen.id)
    let upcoming: RankItem[] = []

    if (IN_QUEUE.includes(chosen.status)) {
      const offered = new Set(offers.map((o) => o.institutionId))
      const { ranking } = await api.matches(chosen.id, 'multicriteria')

      upcoming = ranking.filter((item) => !offered.has(item.institution.id))
    }

    return { ...empty, batches, institutions, batch: chosen, offers, upcoming }
  }, [batchId, session.id])

  const batch = data?.batch ?? null
  const offers = data?.offers ?? []
  const nameOf = (id: string) => data?.institutions.find((i) => i.id === id)?.name ?? 'Instituição'
  const me = data?.institutions.find((i) => i.id === session.id) ?? null

  // A fila anda no servidor (prazo de resposta, recusas): atualiza sozinho enquanto o lote não termina.
  useEffect(() => {
    if (!batch || batch.status === 'COLLECTED' || batch.status === 'EXPIRED') return
    const id = setInterval(() => void reload(true), 4000)

    return () => clearInterval(id)
  }, [batch, reload])

  async function act(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    setActionError(null)
    setNotice(null)

    try {
      await action()
      setNotice(message)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Algo deu errado.')
    } finally {
      await reload(true)
      setBusy(false)
    }
  }

  const markers = useMemo<MapMarker[]>(() => {
    if (!data || !batch) return []

    const result: MapMarker[] = [
      { lat: batch.latitude, lng: batch.longitude, text: FOOD_ICON[batch.foodType], kind: 'batch', tooltip: 'Local de retirada' },
    ]

    if (!isDonor) {
      if (me) result.push({ lat: me.latitude, lng: me.longitude, text: '★', kind: 'first', tooltip: `${me.name} (você)` })

      return result
    }

    const active = offers.find((o) => o.status === 'PENDING' || o.status === 'ACCEPTED')
    const shown = new Set<string>()

    if (active) shown.add(active.institutionId)
    for (const item of data.upcoming) shown.add(item.institution.id)

    for (const inst of data.institutions) {
      if (!shown.has(inst.id)) continue

      const current = inst.id === active?.institutionId

      result.push({
        lat: inst.latitude,
        lng: inst.longitude,
        text: current ? '★' : '•',
        kind: current ? 'first' : 'ranked',
        tooltip: current ? `${inst.name} (oferta atual)` : `${inst.name} (na fila)`,
      })
    }

    return result
  }, [data, batch, offers, isDonor, me])

  const emptyText = isDonor
    ? 'Você ainda não cadastrou doações. Cadastre uma para acompanhar aqui.'
    : 'Nenhuma doação foi oferecida à sua instituição ainda.'

  return (
    <section aria-labelledby="t-match">
      <div className="screen-frame">
        <div className="results">
          <h2 id="t-match" style={{ fontSize: '1.5rem' }}>Detalhes da doação</h2>

          {(data?.batches.length ?? 0) > 1 && (
            <div className="picker">
              <div className="field">
                <label htmlFor="lote">Doação</label>
                <select id="lote" value={batch?.id ?? ''} onChange={(e) => onSelect(e.target.value)}>
                  {(data?.batches ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {FOOD_LABEL[b.foodType]} · {num(b.quantityKg)} kg · {STATUS_LABEL[b.status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && <div className="banner error" role="alert">{error}</div>}
          {loading && !data && <p>Carregando…</p>}
          {!loading && data && !batch && <div className="empty">{emptyText}</div>}
          {actionError && <div className="banner error" role="alert">{actionError}</div>}
          {notice && <div className="banner ok" role="status">{notice}</div>}

          {data && batch && (
            <>
              <DonationCard
                batch={batch}
                now={now}
                distanceFromYou={!isDonor && me ? distanceKm(me, batch) : null}
              />

              <div className="detail-grid">
                <div>
                  {isDonor ? (
                    <>
                      <DonorStatusPanel batch={batch} offers={offers} nameOf={nameOf} now={now} />
                      <OffersList batch={batch} offers={offers} upcoming={data.upcoming} nameOf={nameOf} now={now} />
                    </>
                  ) : (
                    <InstitutionOfferPanel
                      batch={batch}
                      offer={data.myOffer}
                      now={now}
                      busy={busy}
                      onAccept={(id) => act(() => api.accept(id, session.id), 'Oferta aceita! Agora é só retirar e registrar a retirada.')}
                      onDecline={(id) => act(() => api.decline(id, session.id), 'Oferta recusada. A doação seguiu para a próxima instituição.')}
                      onPickup={(id) => act(() => api.pickup(id, session.id), 'Retirada registrada. Obrigado!')}
                    />
                  )}
                </div>

                <div>
                  <h3 className="section-title">Local de retirada</h3>
                  {batch.address && <p className="map-address">{batch.address.formatted}</p>}
                  <MapView markers={markers} label="Mapa com o local de retirada da doação" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

/** O que está sendo doado, em destaque. */
function DonationCard({ batch, now, distanceFromYou }: { batch: Batch; now: number; distanceFromYou: number | null }) {
  const left = hoursLeft(batch.expiresAt, now)
  const urgent = left > 0 && left < 24 && batch.status !== 'COLLECTED'

  return (
    <article className="donation-card" aria-label="Informações da doação">
      <div className="donation-head">
        <div className="donation-icon" aria-hidden="true">{FOOD_ICON[batch.foodType]}</div>
        <div className="donation-title">
          <span className="eyebrow">Doação de {donorName(batch.donorId)}</span>
          <h3>{FOOD_LABEL[batch.foodType]}</h3>
          <p className="donation-qty">{num(batch.quantityKg)} kg</p>
        </div>
        <span className={`status-pill ${batch.status.toLowerCase()}`}>{STATUS_LABEL[batch.status]}</span>
      </div>

      <dl className="facts">
        {batch.address && (
          <div className="fact wide">
            <dt>Endereço de retirada</dt>
            <dd>
              {batch.address.street}, {batch.address.number}
              {batch.address.complement ? `, ${batch.address.complement}` : ''}
              <small>
                {[batch.address.district, `${batch.address.city}/${batch.address.state}`, batch.address.postalCode].filter(Boolean).join(' · ')}
              </small>
            </dd>
          </div>
        )}
        <div className={`fact ${urgent ? 'urgent' : ''}`}>
          <dt>Validade</dt>
          <dd>
            {formatDateTimeLong(batch.expiresAt)}
            <small>{left > 0 ? `vence em ${formatHours(left)}` : 'vencido'}</small>
          </dd>
        </div>
        <div className="fact">
          <dt>Armazenamento</dt>
          <dd>
            {STORAGE_LABEL[batch.storageCondition]}
            <small>{batch.storageCondition === 'DRY' ? 'não precisa de refrigeração' : 'transportar e guardar refrigerado'}</small>
          </dd>
        </div>
        {distanceFromYou !== null ? (
          <div className="fact">
            <dt>Distância</dt>
            <dd>
              {num(distanceFromYou)} km
              <small>em linha reta até a sua instituição</small>
            </dd>
          </div>
        ) : null}
        <div className="fact">
          <dt>Cadastrada em</dt>
          <dd>{formatDateTime(batch.createdAt)}</dd>
        </div>
      </dl>
    </article>
  )
}

function Timeline({ accepted, collected }: { accepted: boolean; collected: boolean }) {
  return (
    <ol className="timeline" aria-label="Etapas da doação">
      <li className="done">Oferecida à instituição</li>
      <li className={accepted || collected ? 'done' : 'now'}>Aceita</li>
      <li className={collected ? 'done' : accepted ? 'now' : ''}>Retirada</li>
    </ol>
  )
}

/** Doador: só acompanha. Quem responde à oferta é a instituição. */
function DonorStatusPanel({
  batch, offers, nameOf, now,
}: {
  batch: Batch
  offers: Offer[]
  nameOf: (id: string) => string
  now: number
}) {
  const accepted = offers.find((o) => o.status === 'ACCEPTED') ?? null
  const pending = offers.find((o) => o.status === 'PENDING') ?? null

  if (batch.status === 'EXPIRED') {
    return <div className="banner info">A validade desta doação passou antes de alguma instituição aceitar.</div>
  }

  if (batch.status === 'COLLECTED') {
    return (
      <div className="reservation">
        <h3>Doação retirada ✓</h3>
        <p style={{ margin: 0 }}>Retirada por <b>{accepted ? nameOf(accepted.institutionId) : 'instituição'}</b>.</p>
        <Timeline accepted collected />
      </div>
    )
  }

  if (accepted) {
    return (
      <div className="reservation">
        <h3>Aceita — aguardando a retirada</h3>
        <p style={{ margin: 0 }}>
          <b>{nameOf(accepted.institutionId)}</b> aceitou em {formatDateTime(accepted.respondedAt ?? accepted.createdAt)} e vai buscar a doação.
        </p>
        <Timeline accepted collected={false} />
      </div>
    )
  }

  if (pending) {
    const remaining = new Date(pending.expiresAt).getTime() - now

    return (
      <div className="reservation">
        <h3>Oferecida — aguardando resposta</h3>
        <p style={{ margin: 0 }}>A doação está oferecida para <b>{nameOf(pending.institutionId)}</b>.</p>
        <Timeline accepted={false} collected={false} />
        <p style={{ margin: 0 }}>
          Prazo para responder:{' '}
          <span className="countdown">{remaining > 0 ? formatCountdown(remaining) : 'encerrado'}</span>
        </p>
        <p className="hint" style={{ color: 'var(--muted-2)', fontSize: '.82rem', marginBottom: 0 }}>
          Se a instituição recusar ou não responder no prazo, a doação é oferecida automaticamente à próxima.
        </p>
      </div>
    )
  }

  return (
    <div className="banner info">
      Nenhuma instituição disponível para receber esta doação agora. Ela será oferecida assim que houver uma.
    </div>
  )
}

/** Doador: histórico das ofertas e próximas instituições da fila. */
function OffersList({
  batch, offers, upcoming, nameOf, now,
}: {
  batch: Batch
  offers: Offer[]
  upcoming: RankItem[]
  nameOf: (id: string) => string
  now: number
}) {
  if (offers.length === 0 && upcoming.length === 0) return null

  const statusOf = (offer: Offer) => {
    switch (offer.status) {
      case 'PENDING': {
        const remaining = new Date(offer.expiresAt).getTime() - now

        return { text: remaining > 0 ? `Aguardando · ${formatCountdown(remaining)}` : 'Aguardando', tone: 'pending' }
      }
      case 'ACCEPTED':
        return batch.status === 'COLLECTED' ? { text: 'Retirou', tone: 'done' } : { text: 'Aceitou', tone: 'done' }
      case 'DECLINED':
        return { text: 'Recusou', tone: 'off' }
      case 'EXPIRED':
        return { text: 'Não respondeu no prazo', tone: 'off' }
    }
  }

  return (
    <div className="offers-box">
      <h3 className="section-title">Ofertas</h3>
      <ol className="offer-list">
        {offers.map((offer, index) => {
          const status = statusOf(offer)

          return (
            <li key={offer.id} className={`offer-item ${status.tone}`}>
              <span className="pos">{index + 1}</span>
              <div>
                <b>{nameOf(offer.institutionId)}</b>
                <span className="when">Oferecida em {formatDateTime(offer.createdAt)}</span>
              </div>
              <span className={`offer-tag ${status.tone}`}>{status.text}</span>
            </li>
          )
        })}
        {upcoming.map((item, index) => (
          <li key={item.institution.id} className="offer-item next">
            <span className="pos">{offers.length + index + 1}</span>
            <div>
              <b>
                {item.institution.name}
                {item.criteria.need >= 0.75 && <span className="need-tag">estoque baixo</span>}
              </b>
              <span className="when">{num(item.distanceKm)} km do local de retirada</span>
            </div>
            <span className="offer-tag next">{index === 0 && !offers.some((o) => o.status === 'PENDING') ? 'Próxima' : 'Na fila'}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Instituição: responde à oferta que recebeu e registra a retirada. */
function InstitutionOfferPanel({
  batch, offer, now, busy, onAccept, onDecline, onPickup,
}: {
  batch: Batch
  offer: InstitutionOffer['offer'] | null
  now: number
  busy: boolean
  onAccept: (id: string) => void
  onDecline: (id: string) => void
  onPickup: (id: string) => void
}) {
  if (!offer) return null

  if (offer.status === 'DECLINED' || offer.status === 'EXPIRED') {
    return <div className="banner info">{OFFER_LABEL[offer.status]}. Esta doação foi oferecida a outra instituição.</div>
  }

  const accepted = offer.status === 'ACCEPTED'
  const collected = accepted && batch.status === 'COLLECTED'
  const remaining = new Date(offer.expiresAt).getTime() - now

  return (
    <div className="reservation">
      <h3>{collected ? 'Doação retirada ✓' : accepted ? 'Você aceitou — falta retirar' : 'Esta doação foi oferecida a você'}</h3>
      <p style={{ margin: 0 }}>Oferecida em {formatDateTime(offer.createdAt)}</p>

      <Timeline accepted={accepted} collected={collected} />

      {offer.status === 'PENDING' && (
        <>
          <p style={{ margin: '0 0 12px' }}>
            Prazo para responder:{' '}
            <span className="countdown">{remaining > 0 ? formatCountdown(remaining) : 'encerrado'}</span>
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-forest" disabled={busy || remaining <= 0} onClick={() => onAccept(offer.id)}>
              Aceitar doação
            </button>
            <button className="btn btn-danger" disabled={busy || remaining <= 0} onClick={() => onDecline(offer.id)}>
              Recusar
            </button>
          </div>
          <p className="hint" style={{ marginTop: 12, color: 'var(--muted-2)', fontSize: '.82rem' }}>
            Se você recusar ou o prazo acabar, a doação segue para a próxima instituição e não volta a ser oferecida a você.
          </p>
        </>
      )}

      {accepted && !collected && (
        <button className="btn btn-forest" disabled={busy} onClick={() => onPickup(offer.id)}>
          Registrar retirada
        </button>
      )}
    </div>
  )
}
