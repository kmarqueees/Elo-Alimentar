import type { RankItem } from '../api'
import { num, points } from '../format'

interface RankCardProps {
  item: RankItem
  detailed: boolean
  problem?: string | undefined
  action?: React.ReactNode
}

export function RankCard({ item, detailed, problem, action }: RankCardProps) {
  const first = item.position === 1 && !problem

  return (
    <div className={`rank-card ${first ? 'top' : ''} ${problem ? 'bad' : ''}`}>
      <div className="rank-pos" aria-label={`Posição ${item.position}`}>{item.position}º</div>
      <div>
        <h4>{item.institution.name}</h4>
        <p className="meta">{num(item.distanceKm)} km · {num(item.travelMinutes)} min de deslocamento</p>
        {problem && <p className="why">⚠ Inviável: {problem}</p>}
        {detailed && (
          <div className="crit-bars">
            <div className="crit"><span>Proximidade</span><div className="bar-track"><div className="bar-fill" style={{ width: `${points(item.criteria.proximity)}%` }} /></div><b>{points(item.criteria.proximity)}</b></div>
            <div className="crit"><span>Urgência atendida</span><div className="bar-track"><div className="bar-fill mango" style={{ width: `${points(item.criteria.urgency)}%` }} /></div><b>{points(item.criteria.urgency)}</b></div>
            <div className="crit"><span>Compatibilidade</span><div className="bar-track"><div className="bar-fill berry" style={{ width: `${points(item.criteria.compatibility)}%` }} /></div><b>{points(item.criteria.compatibility)}</b></div>
          </div>
        )}
        {action}
      </div>
      <div className="score">
        <b>{points(item.score)}</b>
        <span>{detailed ? 'pontuação final' : 'proximidade'}</span>
      </div>
    </div>
  )
}
