import { useEffect, useState } from 'react'
import { api, type Institution } from '../api'
import { DEMO_DONORS, type Role, type Session } from '../session'

interface LoginProps {
  role: Role
  onRole: (role: Role) => void
  onEnter: (session: Session) => void
  onBack: () => void
}

export function Login({ role, onRole, onEnter, onBack }: LoginProps) {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [donorId, setDonorId] = useState(DEMO_DONORS[0]!.id)
  const [institutionId, setInstitutionId] = useState('')

  useEffect(() => {
    api.listInstitutions().then((list) => {
      setInstitutions(list)
      setInstitutionId((current) => current || list[0]?.id || '')
    }).catch(() => setInstitutions([]))
  }, [])

  const donor = DEMO_DONORS.find((d) => d.id === donorId) ?? DEMO_DONORS[0]!
  const institution = institutions.find((i) => i.id === institutionId)
  const email = role === 'donor' ? donor.email : `contato@${(institution?.name ?? 'instituicao').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.demo`

  const enter = (event: React.FormEvent) => {
    event.preventDefault()

    if (role === 'donor') onEnter({ role, id: donor.id, name: donor.name, email: donor.email })
    else if (institution) onEnter({ role, id: institution.id, name: institution.name, email })
  }

  return (
    <section aria-labelledby="t-login">
      <div className="screen-frame">
        <div className="login-wrap">
          <div className="login-side">
            <h2>Bem-vindo de volta</h2>
            <p>Entre para {role === 'donor' ? 'cadastrar doações e acompanhar quem vai retirá-las.' : 'ver as doações compatíveis com a sua instituição e solicitar a retirada.'}</p>
            <ul>
              <li>Ranking de compatibilidade em tempo real</li>
              <li>Prazo de resposta e reoferta automática</li>
              <li>Acessível por teclado e leitor de tela</li>
            </ul>
          </div>

          <form className="login-form" onSubmit={enter}>
            <h1 id="t-login" style={{ fontSize: '1.6rem' }}>Entrar</h1>
            <div className="banner info" style={{ marginTop: 12 }}>
              <b>Login de demonstração.</b> Nenhuma senha é verificada; o cadastro e a autenticação reais entram na próxima etapa.
            </div>

            <div className="segmented" role="group" aria-label="Tipo de conta">
              <button type="button" aria-pressed={role === 'donor'} onClick={() => onRole('donor')}>Sou doador</button>
              <button type="button" aria-pressed={role === 'institution'} onClick={() => onRole('institution')}>Sou instituição</button>
            </div>

            <div className="field">
              <label htmlFor="conta">{role === 'donor' ? 'Conta de doador (demo)' : 'Instituição (demo)'}</label>
              {role === 'donor' ? (
                <select id="conta" value={donorId} onChange={(e) => setDonorId(e.target.value)}>
                  {DEMO_DONORS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              ) : (
                <select id="conta" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
                  {institutions.length === 0 && <option value="">API offline — suba o back end</option>}
                  {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              )}
            </div>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" value={email} readOnly />
            </div>
            <div className="field">
              <label htmlFor="senha">Senha</label>
              <input id="senha" type="password" value="demonstracao" readOnly />
            </div>

            <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={role === 'institution' && !institution}>Entrar</button>
            <p className="login-foot">
              Ainda não tem conta? <span className="soon">Cadastre-se (em breve)</span> ·{' '}
              <button type="button" className="link" onClick={onBack}>Voltar ao início</button>
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}
