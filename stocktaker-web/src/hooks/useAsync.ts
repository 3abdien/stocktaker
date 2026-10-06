// A small custom hook that turns "call this async function and track its
// state" into three variables instead of five `useState` calls copy-pasted
// into every page. Two subtleties worth being able to explain out loud:
//
// 1. The `cancelled` flag. If a component unmounts (or its dependencies
//    change, kicking off a NEW fetch) before a fetch resolves, calling
//    `setState` from the stale, in-flight request would either warn about
//    updating an unmounted component or - worse - silently overwrite
//    fresher data with stale data that just happened to resolve later.
//    The effect's cleanup function flips `cancelled` to true, and every
//    `setState` call checks it first.
// 2. `reload`. Bumping a counter that's included in the dependency array
//    is a common trick to re-run an effect on demand (e.g. an "Refresh"
//    button, or after a modal closes having changed the data) without
//    duplicating the fetch logic outside the hook.

import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'

interface UseAsyncResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): UseAsyncResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fn()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // `fn` is intentionally not in the dependency array - callers pass a
    // new closure every render, which would re-run this effect on every
    // render if included. Callers are responsible for putting the real
    // inputs (a site id, a filter, etc.) into `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount])

  return { data, loading, error, reload: () => setReloadCount((c) => c + 1) }
}
