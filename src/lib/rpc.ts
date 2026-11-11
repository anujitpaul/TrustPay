/** Small helpers for resilient RPC reads (retry with backoff on rate limits and lagging backends). */

const RETRYABLE = [
  '-32014', // backend has not imported the requested block yet (load-balanced primary)
  '-32005', // rate limit
  'rate limit',
  '429',
  'timeout',
  'timed out',
  'failed to fetch',
  'not yet imported',
  'internal error',
]

function isRetryable(error: unknown): boolean {
  const text = `${(error as Error)?.message ?? ''} ${(error as { details?: string })?.details ?? ''}`.toLowerCase()
  if (text.includes('range too large') || text.includes('-32012')) return false
  return RETRYABLE.some((needle) => text.includes(needle))
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function withRetry<T>(run: () => Promise<T>, attempts = 4, baseDelayMs = 500): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (attempt === attempts - 1 || !isRetryable(error)) break
      await sleep(baseDelayMs * 2 ** attempt + Math.random() * 150)
    }
  }
  throw lastError
}

/** Run async tasks with a concurrency limit, preserving result order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await task(items[index])
    }
  })
  await Promise.all(workers)
  return results
}
