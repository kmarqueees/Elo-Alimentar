import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type AppNotification } from '../api'
import type { Session } from '../session'

const POLL_MS = 15_000

const ICON: Record<AppNotification['type'], string> = {
  OFFER_RECEIVED: '🎁',
  OFFER_REMINDER: '⏰',
  OFFER_TIMED_OUT: '⌛',
  OFFER_ACCEPTED: '✅',
  OFFER_DECLINED: '↩️',
  OFFER_EXPIRED: '⌛',
  WAITING_FOR_INSTITUTION: '⏳',
  DONATION_COLLECTED: '📦',
  BATCH_EXPIRED: '⚠️',
}

const browserSupport = typeof window !== 'undefined' && 'Notification' in window

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)

  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  if (minutes < 24 * 60) return `há ${Math.round(minutes / 60)} h`

  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

interface NotificationBellProps {
  session: Session
  onOpen: (batchId: string) => void
}

/**
 * Sininho do cabeçalho. Busca as notificações a cada 15 s; quando chega uma
 * nova e o usuário permitiu, também mostra o aviso do navegador (útil quando
 * a aba está em segundo plano e o prazo de resposta está correndo).
 */
export function NotificationBell({ session, onOpen }: NotificationBellProps) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [permission, setPermission] = useState(browserSupport ? Notification.permission : 'denied')
  const seen = useRef<Set<string> | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  // Guarda a função mais recente sem reiniciar o ciclo de atualização a cada renderização.
  const onOpenRef = useRef(onOpen)

  onOpenRef.current = onOpen

  const load = useCallback(async () => {
    try {
      const { notifications, unreadCount } = await api.notifications(session.id)

      // Na primeira carga só registra o que já existe; depois, avisa o que for novo.
      if (seen.current && browserSupport && Notification.permission === 'granted') {
        for (const item of notifications) {
          if (!item.readAt && !seen.current.has(item.id)) {
            const browserNotice = new Notification(item.title, { body: item.message, tag: item.id })

            browserNotice.onclick = () => {
              window.focus()
              if (item.batchId) onOpenRef.current(item.batchId)
              browserNotice.close()
            }
          }
        }
      }

      seen.current = new Set(notifications.map((item) => item.id))
      setItems(notifications)
      setUnread(unreadCount)
    } catch {
      // Sem conexão: tenta de novo na próxima rodada; o banner geral já avisa o usuário.
    }
  }, [session.id])

  useEffect(() => {
    seen.current = null
    void load()
    const id = setInterval(() => void load(), POLL_MS)

    return () => clearInterval(id)
  }, [load])

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return

    const onClick = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function select(item: AppNotification) {
    setOpen(false)

    if (!item.readAt) {
      await api.markNotificationRead(item.id, session.id).catch(() => undefined)
      void load()
    }

    if (item.batchId) onOpenRef.current(item.batchId)
  }

  async function markAll() {
    await api.markAllNotificationsRead(session.id).catch(() => undefined)
    void load()
  }

  async function enableBrowser() {
    if (!browserSupport) return
    setPermission(await Notification.requestPermission())
  }

  return (
    <div className="notif" ref={boxRef}>
      <button
        type="button"
        className="notif-button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notificações: ${unread} não lida(s)` : 'Notificações'}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && <span className="notif-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notificações">
          <div className="notif-head">
            <b>Notificações</b>
            {unread > 0 && <button type="button" className="link" onClick={() => void markAll()}>Marcar todas como lidas</button>}
          </div>

          {browserSupport && permission === 'default' && (
            <div className="notif-permission">
              Receba um aviso no navegador quando chegar uma doação, mesmo com o site em outra aba.
              <button type="button" className="btn btn-forest btn-sm" onClick={() => void enableBrowser()}>Ativar avisos</button>
            </div>
          )}

          {items.length === 0 ? (
            <p className="notif-empty">Nenhuma notificação por enquanto.</p>
          ) : (
            <ul className="notif-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button type="button" className={`notif-item ${item.readAt ? '' : 'unread'}`} onClick={() => void select(item)}>
                    <span className="notif-icon" aria-hidden="true">{ICON[item.type]}</span>
                    <span className="notif-text">
                      <b>{item.title}</b>
                      <span>{item.message}</span>
                      <small>{timeAgo(item.createdAt)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
