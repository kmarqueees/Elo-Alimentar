import { useState } from 'react'
import { getApiUrl, setApiUrl } from '../api'
import { getFlag, getFontScale, setFlag, setFontScale } from '../prefs'

interface HelpProps {
  onApiChanged: () => void
}

export function Help({ onApiChanged }: HelpProps) {
  const [hc, setHc] = useState(getFlag('hc'))
  const [motion, setMotion] = useState(getFlag('reduce-motion'))
  const [font, setFont] = useState(getFontScale())
  const [url, setUrl] = useState(getApiUrl())

  return (
    <section aria-labelledby="t-help">
      <div className="screen-frame">
        <div className="help-wrap">
          <div>
            <h2 id="t-help" style={{ fontSize: '1.3rem', marginBottom: 14 }}>Preferências de acessibilidade</h2>
            <div className="a11y-settings">
              <div className="setting-row">
                <span id="l-hc">Alto contraste</span>
                <button className={`toggle ${hc ? 'on' : ''}`} role="switch" aria-checked={hc} aria-labelledby="l-hc"
                  onClick={() => { setFlag('hc', !hc); setHc(!hc) }} />
              </div>
              <div className="setting-row">
                <span>Tamanho da fonte ({font}%)</span>
                <div className="font-steps">
                  <button aria-label="Diminuir fonte" onClick={() => setFont(setFontScale(font - 10))}>A-</button>
                  <button aria-label="Aumentar fonte" onClick={() => setFont(setFontScale(font + 10))}>A+</button>
                </div>
              </div>
              <div className="setting-row">
                <span id="l-rm">Reduzir animações</span>
                <button className={`toggle ${motion ? 'on' : ''}`} role="switch" aria-checked={motion} aria-labelledby="l-rm"
                  onClick={() => { setFlag('reduce-motion', !motion); setMotion(!motion) }} />
              </div>
            </div>

            <h2 style={{ fontSize: '1.3rem', margin: '26px 0 14px' }}>Conexão com a API</h2>
            <div className="api-row">
              <input aria-label="Endereço da API" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button className="btn btn-forest btn-sm" onClick={() => { setApiUrl(url); onApiChanged() }}>Salvar e testar</button>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: 14 }}>Perguntas frequentes</h2>
            <div className="faq-item">
              <h4>Como sei se meu lote foi aceito?</h4>
              <p>Na tela “Resultado do matching” você acompanha cada etapa: solicitado pela instituição, aceito pelo doador e retirado.</p>
            </div>
            <div className="faq-item">
              <h4>O que acontece se ninguém confirmar a tempo?</h4>
              <p>A reserva expira, o lote volta a ficar disponível e a próxima instituição do ranking passa a ser a sugestão. Quem foi recusado não volta ao ranking daquele lote.</p>
            </div>
            <div className="faq-item">
              <h4>Como minha instituição é validada?</h4>
              <p>Só participam do matching instituições validadas por um administrador.</p>
            </div>
            <div className="faq-item">
              <h4>Como a pontuação é calculada?</h4>
              <p>Soma ponderada de proximidade (40%), urgência atendida (35%) e compatibilidade (25%). Refrigeração é regra eliminatória, não nota.</p>
            </div>
            <div className="faq-item">
              <h4>Os dados são reais?</h4>
              <p>Não. Instituições e lotes são sintéticos, gerados para a demonstração do projeto.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
