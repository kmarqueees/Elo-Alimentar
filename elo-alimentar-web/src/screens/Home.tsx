import { api } from '../api'
import { useLoad } from '../hooks'
import type { Role } from '../session'

interface HomeProps {
  onChoose: (role: Role) => void
}

export function Home({ onChoose }: HomeProps) {
  const { data } = useLoad(
    () => Promise.all([api.listBatches('ALL'), api.listInstitutions()]),
    [],
  )
  const [batches, institutions] = data ?? [null, null]
  const inQueue = batches?.filter((b) => b.status === 'AVAILABLE' || b.status === 'OFFERED').length
  const collected = batches?.filter((b) => b.status === 'COLLECTED').length

  return (
    <section aria-labelledby="t-home">
      <div className="screen-frame">
        <div className="hero">
          <div>
            <h1 id="t-home">Conectar quem tem com quem precisa, no tempo certo.</h1>
            <p>
              O Elo Alimentar usa geolocalização e um algoritmo de compatibilidade para levar alimentos
              excedentes até instituições que podem aproveitá-los antes que se percam.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => onChoose('donor')}>Quero doar alimentos</button>
              <button className="btn btn-outline" onClick={() => onChoose('institution')}>Sou uma instituição receptora</button>
            </div>
          </div>
          <div className="hero-card" aria-live="polite">
            <div className="stat"><span>Doações sendo oferecidas agora</span><b>{inQueue ?? '—'}</b></div>
            <div className="stat"><span>Doações já retiradas</span><b>{collected ?? '—'}</b></div>
            <div className="stat"><span>Instituições parceiras</span><b>{institutions ? institutions.length : '—'}</b></div>
          </div>
        </div>

        <div className="steps">
          <h2 style={{ fontSize: '1.6rem' }}>Como funciona</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">1</div>
              <h3>Cadastre o lote</h3>
              <p>O doador informa tipo de alimento, quantidade, validade, condição de armazenamento e marca o local de retirada no mapa.</p>
            </div>
            <div className="step-card">
              <div className="step-num">2</div>
              <h3>O sistema calcula a compatibilidade</h3>
              <p>Uma pontuação de 0 a 100 cruza proximidade, urgência da validade e compatibilidade da instituição, e ranqueia da melhor para a pior.</p>
            </div>
            <div className="step-card">
              <div className="step-num">3</div>
              <h3>O lote é oferecido em ordem</h3>
              <p>O sistema oferece o lote à 1ª instituição do ranking, que tem 30 minutos para aceitar. Se recusar ou não responder, o lote segue automaticamente para a próxima.</p>
            </div>
          </div>

          <div className="diff-box">
            <div className="item"><h4>Proximidade geográfica</h4><p>Distância real entre doador e receptor calculada a partir das coordenadas.</p></div>
            <div className="item"><h4>Urgência de validade</h4><p>Alimentos com prazo curto ganham prioridade automática no ranqueamento.</p></div>
            <div className="item"><h4>Compatibilidade logística</h4><p>Refrigeração é regra eliminatória; capacidade e tipo de alimento aceito entram na pontuação.</p></div>
          </div>
        </div>
      </div>
    </section>
  )
}
