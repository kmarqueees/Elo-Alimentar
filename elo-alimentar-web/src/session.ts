export type Role = 'donor' | 'institution'

export interface Session {
  role: Role
  id: string
  name: string
  email: string
}

export const DEMO_DONORS = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Padaria Pão Dourado', email: 'contato@paodourado.demo' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Restaurante Sabor da Terra', email: 'contato@sabordaterra.demo' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Mercado Bom Preço', email: 'contato@bompreco.demo' },
  { id: '00000000-0000-4000-8000-000000000004', name: 'Hortifruti Vale Verde', email: 'contato@valeverde.demo' },
]

const KEY = 'elo.session'

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY)

    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session))
    else sessionStorage.removeItem(KEY)
  } catch {}
}
