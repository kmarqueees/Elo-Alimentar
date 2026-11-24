import { useEffect, useState } from 'react'
import { api, type Institution } from '../api'
import { DONOR_ACCOUNTS, type Role, type Session } from '../session'

interface LoginProps {
  role: Role
  onRole: (role: Role) => void
  onEnter: (session: Session) => void
  onBack: () => void
}

export function Login({ role, onRole, onEnter, onBack }: LoginProps) {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [failed, setFailed] = useState(false)
  const [donorId, setDonorId] = useState(DONOR_ACCOUNTS[0]!.id)
  const [institutionId, setInstitutionId] = useState('')

  useEffect(() => {
    api.listInstitutions().then((list) => {
      setInstitutions(list)
      setInstitutionId((current) => current || list[0]?.id || '')
    }).catch(() => setFailed(true))
  }, [])

  const donor = DONOR_ACCOUNTS.find((d) => d.id === donorId) ?? DONOR_ACCOUNTS[0]!
  const institution = institutions.find((i) => i.id === institutionId)

  const enter = (event: React.FormEvent) => {
    event.preventDefault()

    if (role === 'donor') onEnter({ role, id: donor.id, name: donor.name })
    else if (institution) onEnter({ role, id: institution.id, name: institution.name })
  }

  return (
    <section aria-labelledby="t-login">
      <div className="screen-frame">
        <div className="login-wrap">
          <div className="login-side">
            <h2>Bem-vindo de volta</h2>
            <p>Entre para {role === 'donor' ? 'cadastrar doações e acompanhar quem vai retirá-las.' : 'receber as doações oferecidas à sua instituição e aceitar a retirada.'}</p>
            <ul>
              <li>Doações oferecidas a quem melhor pode recebê-las</li>
              <li>Prazo de resposta e reoferta automática</li>
              <li>Acessível por teclado e leitor de tela</li>
            </ul>
          </div>

          <form className="login-form" onSubmit={enter}>
            <h1 id="t-login" style={{ fontSize: '1.6rem' }}>Entrar</h1>

            <div className="segmented" role="group" aria-label="Tipo de conta">
              <button type="button" aria-pressed={role === 'donor'} onClick={() => onRole('donor')}>Sou doador</button>
              <button type="button" aria-pressed={role === 'institution'} onClick={() => onRole('institution')}>Sou instituição</button>
            </div>

            <div className="field">
              <label htmlFor="conta">{role === 'donor' ? 'Estabelecimento doador' : 'Instituição'}</label>
              {role === 'donor' ? (
                <select id="conta" value={donorId} onChange={(e) => setDonorId(e.target.value)}>
                  {DONOR_ACCOUNTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              ) : (
                <select id="conta" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
                  {failed && <option value="">Não foi possível carregar as instituições</option>}
                  {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              )}
            </div>

            <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={role === 'institution' && !institution}>Entrar</button>
            <p className="login-foot">
              <button type="button" className="link" onClick={onBack}>Voltar ao início</button>
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}
