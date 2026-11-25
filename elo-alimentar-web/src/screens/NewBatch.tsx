import { useMemo, useState } from 'react'
import { api, ApiError, type AddressInput, type FoodType, type GeocodedAddress, type StorageCondition } from '../api'
import { MapView, type MapMarker } from '../components/MapView'
import { FOOD_ICON, FOOD_LABEL, STORAGE_LABEL } from '../format'

interface NewBatchProps {
  onCreated: (batchId: string) => void
  donorId: string
}

const PAD = (n: number) => String(n).padStart(2, '0')

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

function defaultExpiry() {
  const d = new Date(Date.now() + 6 * 3_600_000)

  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}T${PAD(d.getHours())}:${PAD(d.getMinutes())}`
}

/** 69005040 → 69005-040 enquanto o usuário digita. */
function maskPostalCode(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)

  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

interface AddressForm {
  postalCode: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
}

const EMPTY_ADDRESS: AddressForm = { postalCode: '', street: '', number: '', complement: '', district: '', city: 'Manaus', state: 'AM' }

type Notice = { tone: 'ok' | 'error' | 'info'; text: string } | null

export function NewBatch({ onCreated, donorId }: NewBatchProps) {
  const [foodType, setFoodType] = useState<FoodType>('HORTIFRUTI')
  const [quantity, setQuantity] = useState('18')
  const [expires, setExpires] = useState(defaultExpiry)
  const [storage, setStorage] = useState<StorageCondition>('REFRIGERATED')
  const [position, setPosition] = useState<[number, number]>([-3.1319, -60.0233])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS)
  /** O ponto no mapa corresponde ao endereço atual (localizado ou ajustado à mão). */
  const [pinConfirmed, setPinConfirmed] = useState(false)
  const [lookingUp, setLookingUp] = useState<'cep' | 'map' | null>(null)
  const [addressNotice, setAddressNotice] = useState<Notice>(null)
  const [candidates, setCandidates] = useState<GeocodedAddress[]>([])

  const markers = useMemo<MapMarker[]>(
    () => [{ lat: position[0], lng: position[1], text: FOOD_ICON[foodType], kind: 'batch', tooltip: 'Local de retirada' }],
    [position, foodType],
  )

  const hasAnyAddress = Boolean(address.street.trim() || address.number.trim() || address.postalCode.trim())

  function updateAddress(patch: Partial<AddressForm>) {
    setAddress((current) => ({ ...current, ...patch }))
    setPinConfirmed(false)
    setCandidates([])
  }

  async function fillFromPostalCode(value: string) {
    const digits = value.replace(/\D/g, '')

    if (digits.length !== 8) return

    setLookingUp('cep')
    setAddressNotice(null)

    try {
      const found = await api.lookupPostalCode(digits)

      updateAddress({
        street: found.street || address.street,
        district: found.district || address.district,
        city: found.city,
        state: found.state,
      })
      setAddressNotice({ tone: 'info', text: 'Endereço preenchido pelo CEP. Informe o número e clique em “Localizar no mapa”.' })
      document.getElementById('numero')?.focus()
    } catch (err) {
      const notFound = err instanceof ApiError && err.status === 404

      setAddressNotice({ tone: 'error', text: notFound ? 'CEP não encontrado. Confira os números ou preencha o endereço manualmente.' : err instanceof Error ? err.message : 'Não foi possível buscar o CEP.' })
    } finally {
      setLookingUp(null)
    }
  }

  function applyCandidate(result: GeocodedAddress) {
    setPosition([result.latitude, result.longitude])
    setPinConfirmed(true)
    setCandidates([])
    setAddressNotice({ tone: 'ok', text: `Local encontrado: ${result.label}. Se o ponto não estiver exato, clique no mapa para ajustar.` })
  }

  /** Procura o endereço digitado no mapa. Devolve true se posicionou o marcador. */
  async function locate(): Promise<boolean> {
    const query = [
      address.street && address.number ? `${address.street}, ${address.number}` : address.street,
      address.district,
      address.city,
      address.state,
    ].filter((part) => part.trim()).join(', ')

    if (!address.street.trim()) {
      setAddressNotice({ tone: 'error', text: 'Informe a rua (ou o CEP) para localizar no mapa.' })
      return false
    }

    setLookingUp('map')
    setAddressNotice(null)

    try {
      let results = await api.searchAddress(query)

      // Sem resultado com o número, tenta só a rua: o mapa pode não ter a numeração.
      if (results.length === 0 && address.number.trim()) {
        results = await api.searchAddress([address.street, address.district, address.city, address.state].filter((p) => p.trim()).join(', '))
      }

      if (results.length === 0) {
        setAddressNotice({ tone: 'error', text: 'Não encontramos este endereço no mapa. Marque o local de retirada clicando no mapa.' })
        return false
      }

      if (results.length === 1) {
        applyCandidate(results[0]!)
      } else {
        applyCandidate(results[0]!)
        setCandidates(results)
        setAddressNotice({ tone: 'info', text: 'Encontramos mais de um local. Usamos o primeiro; escolha outro abaixo se não for este.' })
      }

      return true
    } catch (err) {
      setAddressNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Não foi possível localizar o endereço.' })
      return false
    } finally {
      setLookingUp(null)
    }
  }

  function buildAddress(): AddressInput | undefined | 'incomplete' {
    if (!hasAnyAddress) return undefined

    if (!address.street.trim() || !address.number.trim() || !address.city.trim() || !address.state) return 'incomplete'

    return {
      street: address.street,
      number: address.number,
      complement: address.complement || null,
      district: address.district || null,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode || null,
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const quantityKg = Number(quantity.replace(',', '.'))
    const expiresAt = new Date(expires)

    if (!(quantityKg > 0)) return setError('Informe uma quantidade maior que zero.')
    if (Number.isNaN(expiresAt.getTime())) return setError('Informe a data de validade.')
    if (expiresAt.getTime() <= Date.now()) return setError('A validade precisa ser uma data futura.')

    const pickupAddress = buildAddress()

    if (pickupAddress === 'incomplete') return setError('Complete o endereço de retirada (rua, número, cidade e UF) ou deixe os campos em branco e marque só no mapa.')

    // Endereço digitado, mas o marcador ainda não foi posicionado nele: localiza antes de salvar.
    if (pickupAddress && !pinConfirmed && !(await locate())) {
      return setError('Confirme o local de retirada no mapa antes de cadastrar.')
    }

    setSaving(true)

    try {
      const batch = await api.createBatch({
        donorId,
        foodType,
        quantityKg,
        expiresAt: expiresAt.toISOString(),
        storageCondition: storage,
        latitude: position[0],
        longitude: position[1],
        ...(pickupAddress ? { address: pickupAddress } : {}),
      })

      onCreated(batch.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cadastrar o lote.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="t-new">
      <div className="screen-frame">
        <form className="form-wrap" onSubmit={submit} noValidate>
          <h2 id="t-new" style={{ fontSize: '1.5rem' }}>Cadastro de doação</h2>
          <p className="lede" style={{ marginBottom: 24 }}>Registre uma doação. Ao cadastrar, ela é oferecida automaticamente à instituição mais adequada.</p>

          <div className="form-grid">
            <div>
              <div className="field">
                <label htmlFor="tipo" className="required">Tipo de alimento</label>
                <select id="tipo" value={foodType} onChange={(e) => setFoodType(e.target.value as FoodType)}>
                  {(Object.keys(FOOD_LABEL) as FoodType[]).map((key) => (
                    <option key={key} value={key}>{FOOD_LABEL[key]}</option>
                  ))}
                </select>
              </div>

              <div className="two-col">
                <div className="field">
                  <label htmlFor="qtd" className="required">Quantidade (kg)</label>
                  <input id="qtd" type="number" min="0.1" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Ex: 18" />
                </div>
                <div className="field">
                  <label htmlFor="validade" className="required">Validade</label>
                  <input id="validade" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
                </div>
              </div>

              <div className="field">
                <span className="label required" id="cond-label">Condição de armazenamento</span>
                <div className="radio-group" role="radiogroup" aria-labelledby="cond-label">
                  {(Object.keys(STORAGE_LABEL) as StorageCondition[]).map((key) => (
                    <label key={key}>
                      <input type="radio" name="cond" checked={storage === key} onChange={() => setStorage(key)} /> {STORAGE_LABEL[key]}
                    </label>
                  ))}
                </div>
                <p className="hint">Alimentos refrigerados ou congelados só são indicados a instituições com refrigeração.</p>
              </div>

              <fieldset className="address-box">
                <legend>Endereço de retirada</legend>
                <p className="hint" style={{ marginTop: 0 }}>Digite o CEP para preencher a rua automaticamente, ou preencha à mão. Também é possível marcar só no mapa.</p>

                <div className="two-col">
                  <div className="field">
                    <label htmlFor="cep">CEP</label>
                    <input
                      id="cep"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="00000-000"
                      value={address.postalCode}
                      onChange={(e) => {
                        const masked = maskPostalCode(e.target.value)

                        updateAddress({ postalCode: masked })
                        if (masked.replace(/\D/g, '').length === 8) void fillFromPostalCode(masked)
                      }}
                    />
                    {lookingUp === 'cep' && <p className="hint">Buscando CEP…</p>}
                  </div>
                  <div className="field">
                    <label htmlFor="numero">Número</label>
                    <input id="numero" value={address.number} onChange={(e) => updateAddress({ number: e.target.value })} placeholder="Ex: 520 ou s/n" />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="rua">Rua</label>
                  <input id="rua" autoComplete="address-line1" value={address.street} onChange={(e) => updateAddress({ street: e.target.value })} placeholder="Ex: Av. Eduardo Ribeiro" />
                </div>

                <div className="two-col">
                  <div className="field">
                    <label htmlFor="complemento">Complemento</label>
                    <input id="complemento" value={address.complement} onChange={(e) => updateAddress({ complement: e.target.value })} placeholder="Ex: loja 2, fundos" />
                  </div>
                  <div className="field">
                    <label htmlFor="bairro">Bairro</label>
                    <input id="bairro" value={address.district} onChange={(e) => updateAddress({ district: e.target.value })} />
                  </div>
                </div>

                <div className="address-city">
                  <div className="field">
                    <label htmlFor="cidade">Cidade</label>
                    <input id="cidade" autoComplete="address-level2" value={address.city} onChange={(e) => updateAddress({ city: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="uf">UF</label>
                    <select id="uf" value={address.state} onChange={(e) => updateAddress({ state: e.target.value })}>
                      {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </div>

                <button type="button" className="btn btn-forest btn-sm" disabled={lookingUp !== null} onClick={() => void locate()}>
                  {lookingUp === 'map' ? 'Localizando…' : '📍 Localizar no mapa'}
                </button>

                {addressNotice && (
                  <div className={`banner ${addressNotice.tone}`} role={addressNotice.tone === 'error' ? 'alert' : 'status'} style={{ marginTop: 12, marginBottom: 0 }}>
                    {addressNotice.text}
                  </div>
                )}

                {candidates.length > 1 && (
                  <ul className="candidate-list" aria-label="Outros locais encontrados">
                    {candidates.map((result) => (
                      <li key={`${result.latitude},${result.longitude}`}>
                        <button type="button" className="link" onClick={() => applyCandidate(result)}>{result.label}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>

              <button className="btn btn-primary" type="submit" disabled={saving || lookingUp !== null}>{saving ? 'Cadastrando…' : 'Cadastrar lote'}</button>
              {error && <p role="alert" style={{ color: 'var(--berry)', fontWeight: 600, marginTop: 14 }}>{error}</p>}
            </div>

            <div className="field">
              <span className="label required">Local de retirada no mapa</span>
              <MapView
                markers={markers}
                center={position}
                zoom={15}
                onPick={(lat, lng) => {
                  setPosition([lat, lng])
                  setPinConfirmed(true)
                }}
                label="Mapa para marcar o local de retirada. Clique para escolher ou ajustar o ponto."
              />
              <p className="hint">
                O marcador vai para o endereço quando você clica em “Localizar no mapa”. Clique no mapa para ajustar o ponto
                exato. Ele é usado para calcular a distância até as instituições.
              </p>
            </div>
          </div>
        </form>
      </div>
    </section>
  )
}
