export function aiRequestError(status: number, code?: string): string {
  if (status === 401 || status === 403) return 'Your session has expired. Sign in again to continue.';
  if (status === 429 || code === 'limit_reached') return 'Your AI usage limit has been reached. Choose another model or request a higher limit.';
  if (code === 'Quota service unavailable') return 'AI is temporarily unavailable because usage could not be checked. Please try again shortly.';
  if (status === 503 || status === 502 || status === 504) return 'The AI service is temporarily unavailable. Please try again shortly.';
  return 'Aura could not complete this request. Please try again.';
}

export function aiConnectionError(error: unknown): string {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'The AI request timed out. Please try again.';
  if (error instanceof TypeError) return 'Aura could not connect. Check your internet connection and try again.';
  return error instanceof Error ? error.message : 'Aura could not complete this request. Please try again.';
}
