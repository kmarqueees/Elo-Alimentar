import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { applyPrefs } from './prefs'
import { useLoad } from './hooks'
import { loadSession, saveSession, type Role, type Session } from './session'
import { NotificationBell } from './components/NotificationBell'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Lots } from './screens/Lots'
import { NewBatch } from './screens/NewBatch'
import { Matching } from './screens/Matching'
import { Opportunities } from './screens/Opportunities'
import { MyReservations } from './screens/MyReservations'
import { Profile } from './screens/Profile'
import { Help } from './screens/Help'

type Tab =
  | 'inicio' | 'login'
  | 'meus-lotes' | 'cadastro' | 'resultado' | 'perfil'
  | 'oportunidades' | 'solicitacoes'
  | 'ajuda'

const PUBLIC_TABS: [Tab, string][] = [['inicio', 'Tela inicial'], ['login', 'Login']]
const DONOR_TABS: [Tab, string][] = [
  ['meus-lotes', 'Meus lotes'], ['cadastro', 'Cadastro de doação'], ['resultado', 'Acompanhar lote'],
  ['perfil', 'Perfil'], ['ajuda', 'Ajuda e acessibilidade'],
]
const INSTITUTION_TABS: [Tab, string][] = [
  ['oportunidades', 'Ofertas para você'], ['solicitacoes', 'Minhas retiradas'], ['resultado', 'Detalhe do lote'],
  ['perfil', 'Perfil'], ['ajuda', 'Ajuda e acessibilidade'],
]

const tabsFor = (session: Session | null) =>
  !session ? PUBLIC_TABS : session.role === 'donor' ? DONOR_TABS : INSTITUTION_TABS

const homeFor = (session: Session | null): Tab =>
  !session ? 'inicio' : session.role === 'donor' ? 'meus-lotes' : 'oportunidades'

export function App() {
  const [session, setSession] = useState<Session | null>(loadSession)
  const [loginRole, setLoginRole] = useState<Role>('donor')
  const [tab, setTab] = useState<Tab>(() => {
    const id = location.hash.replace('#', '') as Tab

    return tabsFor(loadSession()).some(([key]) => key === id) ? id : homeFor(loadSession())
  })
  const [batchId, setBatchId] = useState<string | null>(null)
  const [epoch, setEpoch] = useState(0)
  const health = useLoad(() => api.health(), [epoch])

  useEffect(applyPrefs, [])

  const go = useCallback((next: Tab) => {
    location.hash = next
    setTab(next)
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const onHash = () => {
      const id = location.hash.replace('#', '') as Tab

      setTab(tabsFor(session).some(([key]) => key === id) ? id : homeFor(session))
    }

    window.addEventListener('hashchange', onHash)

    return () => window.removeEventListener('hashchange', onHash)
  }, [session])

  const choose = (role: Role) => {
    setLoginRole(role)
    go('login')
  }

  const enter = (next: Session) => {
    saveSession(next)
    setSession(next)
    setBatchId(null)
    go(next.role === 'donor' ? 'meus-lotes' : 'oportunidades')
  }

  const leave = () => {
    saveSession(null)
    setSession(null)
    setBatchId(null)
    go('inicio')
  }

  const openBatch = (id: string) => {
    setBatchId(id)
    go('resultado')
  }

  const tabs = tabsFor(session)

  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>

      <header className="app-header">
        <div className="brand"><span className="brand-mark">E</span>Elo Alimentar</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {session && <NotificationBell key={session.id} session={session} onOpen={openBatch} />}
          {session && (
            <span className="user-chip">
              <span className={`role ${session.role === 'donor' ? 'donor' : ''}`}>{session.role === 'donor' ? 'Doador' : 'Instituição'}</span>
              {session.name}
              <button onClick={leave}>Sair</button>
            </span>
          )}
         
        </div>
      </header>

      <nav className="tabbar" role="tablist" aria-label="Telas do sistema">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" id={`tab-${key}`} aria-selected={tab === key} aria-controls="conteudo" onClick={() => go(key)}>
            {label}
          </button>
        ))}
      </nav>

      <main id="conteudo" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={-1}>
        {health.error && (
          <div className="banner error" role="alert">
            <b>Não foi possível conectar ao servidor.</b> Verifique sua conexão e tente novamente em instantes.{' '}
            <button className="btn btn-ghost btn-sm" onClick={() => { void health.reload(); setEpoch((n) => n + 1) }}>Tentar de novo</button>
          </div>
        )}

        {tab === 'inicio' && <Home key={epoch} onChoose={choose} />}
        {tab === 'login' && <Login role={loginRole} onRole={setLoginRole} onEnter={enter} onBack={() => go('inicio')} />}
        {session?.role === 'donor' && tab === 'meus-lotes' && (
          <Lots key={epoch} donorId={session.id} title="Meus lotes" onOpen={openBatch} onNew={() => go('cadastro')} />
        )}
        {session?.role === 'donor' && tab === 'cadastro' && <NewBatch donorId={session.id} onCreated={openBatch} />}
        {session?.role === 'institution' && tab === 'oportunidades' && <Opportunities key={epoch} session={session} onOpen={openBatch} />}
        {session?.role === 'institution' && tab === 'solicitacoes' && <MyReservations key={epoch} session={session} onOpen={openBatch} />}
        {session && tab === 'resultado' && <Matching key={epoch} batchId={batchId} onSelect={setBatchId} session={session} />}
        {session && tab === 'perfil' && <Profile session={session} />}
        {session && tab === 'ajuda' && <Help />}
      </main>

      <footer>Elo Alimentar — conectando alimentos a quem precisa.</footer>
    </>
  )
}
