import { useMemo, useState } from 'react'
import { api, type FoodType, type StorageCondition } from '../api'
import { MapView, type MapMarker } from '../components/MapView'
import { FOOD_ICON, FOOD_LABEL, STORAGE_LABEL } from '../format'

interface NewBatchProps {
  onCreated: (batchId: string) => void
  donorId: string
}

const PAD = (n: number) => String(n).padStart(2, '0')

function defaultExpiry() {
  const d = new Date(Date.now() + 6 * 3_600_000)

  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}T${PAD(d.getHours())}:${PAD(d.getMinutes())}`
}

export function NewBatch({ onCreated, donorId }: NewBatchProps) {
  const [foodType, setFoodType] = useState<FoodType>('HORTIFRUTI')
  const [quantity, setQuantity] = useState('18')
  const [expires, setExpires] = useState(defaultExpiry)
  const [storage, setStorage] = useState<StorageCondition>('REFRIGERATED')
  const [position, setPosition] = useState<[number, number]>([-3.1319, -60.0233])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const markers = useMemo<MapMarker[]>(
    () => [{ lat: position[0], lng: position[1], text: FOOD_ICON[foodType], kind: 'batch', tooltip: 'Local de retirada' }],
    [position, foodType],
  )

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const quantityKg = Number(quantity.replace(',', '.'))
    const expiresAt = new Date(expires)

    if (!(quantityKg > 0)) return setError('Informe uma quantidade maior que zero.')
    if (Number.isNaN(expiresAt.getTime())) return setError('Informe a data de validade.')
    if (expiresAt.getTime() <= Date.now()) return setError('A validade precisa ser uma data futura.')

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

              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Cadastrando…' : 'Cadastrar lote'}</button>
              {error && <p role="alert" style={{ color: 'var(--berry)', fontWeight: 600, marginTop: 14 }}>{error}</p>}
            </div>

            <div className="field">
              <span className="label required">Local de retirada</span>
              <MapView
                markers={markers}
                center={position}
                zoom={13}
                onPick={(lat, lng) => setPosition([lat, lng])}
                label="Mapa para marcar o local de retirada. Clique para escolher o ponto."
              />
              <p className="hint">
                Clique no mapa para marcar o ponto de retirada ({position[0].toFixed(4)}, {position[1].toFixed(4)}). Usado apenas
                para calcular a distância até as instituições.
              </p>
            </div>
          </div>
        </form>
      </div>
    </section>
  )
}
