import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3333),
  /** Prazo para a instituição responder a uma oferta (RN04). */
  OFFER_TIMEOUT_MINUTES: z.coerce.number().positive().default(30),
  /** De quanto em quanto tempo a fila de ofertas anda. */
  OFFER_QUEUE_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
  /**
   * Identificação enviada ao Nominatim (OpenStreetMap). A política de uso pede
   * o nome da aplicação e um contato, ex.: "EloAlimentar/1.0 (contato@exemplo.org)".
   */
  GEOCODER_USER_AGENT: z.string().min(1).default('EloAlimentar/1.0'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', parsed.error.issues)
  throw new Error('Invalid environment variables.')
}

export const env = parsed.data
