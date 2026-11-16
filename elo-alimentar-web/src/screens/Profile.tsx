import { api, type Institution } from '../api'
import { useLoad } from '../hooks'
import { FOOD_LABEL, num } from '../format'
import type { Session } from '../session'

export function Profile({ session }: { session: Session }) {
  const { data: institutions } = useLoad(
    () => (session.role === 'institution' ? api.listInstitutions() : Promise.resolve([] as Institution[])),
    [session.id],
  )
  const inst = institutions?.find((i) => i.id === session.id)

  return (
    <section aria-labelledby="t-profile">
      <div className="screen-frame">
        <div className="profile">
          <div>
            <div className="avatar" aria-hidden="true">{session.name[0]}</div>
            <p style={{ marginTop: 12 }}><span className={`role ${session.role === 'donor' ? 'donor' : ''}`}>{session.role === 'donor' ? 'Doador' : 'Instituição'}</span></p>
          </div>
          <div>
            <h2 id="t-profile" style={{ fontSize: '1.5rem' }}>{session.name}</h2>
            <p className="lede">Dados de demonstração. A edição do perfil entra com o cadastro real.</p>
            <dl>
              <dt>E-mail</dt><dd>{session.email}</dd>
              {session.role === 'donor' ? (
                <>
                  <dt>Tipo de conta</dt><dd>Doador (comércio / produtor)</dd>
                  <dt>Cidade</dt><dd>Manaus, AM</dd>
                </>
              ) : (
                <>
                  <dt>Tipo de conta</dt><dd>Instituição receptora</dd>
                  <dt>Situação</dt><dd>{inst ? (inst.validated ? 'Validada pelo administrador' : 'Aguardando validação') : '—'}</dd>
                  <dt>Refrigeração</dt><dd>{inst ? (inst.hasRefrigeration ? 'Sim' : 'Não') : '—'}</dd>
                  <dt>Capacidade disponível</dt><dd>{inst ? `${num(inst.availableCapacityKg)} kg` : '—'}</dd>
                  <dt>Aceita</dt><dd>{inst ? (inst.acceptedFoodTypes.length ? inst.acceptedFoodTypes.map((t) => FOOD_LABEL[t]).join(', ') : 'Todos os tipos') : '—'}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
