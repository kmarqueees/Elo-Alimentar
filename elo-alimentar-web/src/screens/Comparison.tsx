import { api } from '../api'
import { useLoad } from '../hooks'
import { num } from '../format'

export function Comparison() {
  const { data, error, loading } = useLoad(() => api.comparison(), [])

  return (
    <section aria-labelledby="t-comp">
      <div className="screen-frame">
        <div className="comparison">
          <h2 id="t-comp" style={{ fontSize: '1.5rem' }}>Comparação das estratégias</h2>
          <p className="lede" style={{ marginBottom: 22 }}>
            As duas estratégias rodadas sobre todos os lotes disponíveis e todas as instituições validadas.
          </p>

          {loading && <p>Carregando…</p>}
          {error && <div className="banner error" role="alert">{error}</div>}

          {data && (
            <>
              <div className="col-card" style={{ marginBottom: 20 }}>
                <p className="meta" style={{ margin: 0 }}>Menos tempo até a retirada (multicritério em relação ao baseline)</p>
                <div className="big-number">{data.timeReductionPercent == null ? '—' : `${num(data.timeReductionPercent)}%`}</div>
                <p className="meta" style={{ margin: '8px 0 0' }}>Calculado sobre os {data.commonCollectedBatches} lotes retirados pelas duas estratégias.</p>
              </div>

              <div className="compare">
                {data.strategies.map((s, index) => (
                  <div key={s.strategy} className={`col-card ${index === 0 ? 'base' : ''}`}>
                    <h3>
                      {s.strategy}
                      <span className="chip">{index === 0 ? 'baseline' : 'Elo Alimentar'}</span>
                    </h3>
                    <dl className="metrics">
                      <dt>Lotes aproveitados</dt>
                      <dd>{s.collectedBatches}/{s.totalBatches} ({num(s.collectionRatePercent)}%)</dd>
                      <dt>1ª indicação era viável</dt>
                      <dd>{num(s.firstChoiceViablePercent)}%</dd>
                      <dt>Instituições acionadas por lote</dt>
                      <dd>{s.averageAttempts == null ? '—' : num(s.averageAttempts)}</dd>
                      <dt>Tempo médio até a retirada</dt>
                      <dd>{s.averageMinutesToPickup == null ? '—' : `${num(s.averageMinutesToPickup)} min`}</dd>
                    </dl>
                  </div>
                ))}
              </div>

              <p className="banner info" style={{ marginTop: 18 }}>
                {data.note} Dados sintéticos: os resultados refletem as premissas do modelo, não medições reais.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
