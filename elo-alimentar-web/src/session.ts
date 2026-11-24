export type Role = 'donor' | 'institution'

export interface Session {
  role: Role
  id: string
  name: string
}

/** Contas de doador cadastradas (a API ainda não expõe uma rota de doadores). */
export const DONOR_ACCOUNTS = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Padaria Pão Dourado' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Restaurante Sabor da Terra' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Mercado Bom Preço' },
  { id: '00000000-0000-4000-8000-000000000004', name: 'Hortifruti Vale Verde' },
]

export const donorName = (id: string) => DONOR_ACCOUNTS.find((d) => d.id === id)?.name ?? 'Doador'

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
