import { useCallback, useEffect, useRef, useState } from 'react'

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const loaderRef = useRef(loader)

  loaderRef.current = loader

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)

    try {
      setData(await loaderRef.current())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => void reload(), deps)

  return { data, error, loading, reload }
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)

    return () => clearInterval(id)
  }, [ms])

  return now
}
