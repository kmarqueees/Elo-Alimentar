import { useState } from 'react'
import { getFlag, getFontScale, setFlag, setFontScale } from '../prefs'

export function Help() {
  const [hc, setHc] = useState(getFlag('hc'))
  const [motion, setMotion] = useState(getFlag('reduce-motion'))
  const [font, setFont] = useState(getFontScale())

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
          </div>

          <div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: 14 }}>Perguntas frequentes</h2>
            <div className="faq-item">
              <h4>Como sei se meu lote foi aceito?</h4>
              <p>Na tela “Acompanhar lote” você vê para qual instituição o lote está oferecido agora e cada etapa: oferecido, aceito pela instituição e retirado.</p>
            </div>
            <div className="faq-item">
              <h4>O que acontece se a instituição não responder a tempo?</h4>
              <p>Cada instituição tem 30 minutos para aceitar a oferta. Se recusar ou o prazo acabar, o lote é oferecido automaticamente à próxima da fila, e quem recusou não recebe aquele lote de novo. Se a validade passar antes de alguém aceitar, o lote sai de circulação.</p>
            </div>
            <div className="faq-item">
              <h4>Como minha instituição é validada?</h4>
              <p>Só recebem ofertas as instituições validadas por um administrador.</p>
            </div>
            <div className="faq-item">
              <h4>Como a pontuação é calculada?</h4>
              <p>Soma ponderada de proximidade (40%), urgência atendida (35%) e compatibilidade (25%). Refrigeração é regra eliminatória, não nota.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
