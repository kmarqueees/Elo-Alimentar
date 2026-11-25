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
              <h4>Como fico sabendo que recebi uma doação?</h4>
              <p>Pelo sininho no topo da tela: ele mostra cada nova oferta, um lembrete quando faltam 10 minutos para o prazo e, para o doador, quando a doação é aceita, recusada, retirada ou vence. Ative os avisos do navegador no próprio sininho para ser avisado mesmo com o site em outra aba.</p>
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
              <p>Soma ponderada de proximidade (30%), urgência da validade (30%), necessidade da instituição (25%) e compatibilidade (15%). Refrigeração, raio de 15 km, espaço de armazenamento e o limite de 2 doações em aberto por instituição são regras eliminatórias, não nota.</p>
            </div>
            <div className="faq-item">
              <h4>O que é a necessidade da instituição?</h4>
              <p>É para quantos dias o estoque da instituição ainda dá, calculado a partir das pessoas que ela atende (0,5 kg por pessoa por dia). Estoque para 1 dia ou menos dá prioridade máxima; para 7 dias ou mais, nenhuma. A instituição pode corrigir o estoque a qualquer momento no Perfil.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
