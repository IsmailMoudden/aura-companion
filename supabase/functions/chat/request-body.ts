export async function readRequestBody(request: Request, limit = 12_000_000): Promise<string> {
  if (Number(request.headers.get('content-length') ?? 0) > limit) throw new RangeError('Request too large');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder(); let total = 0; let result = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw new RangeError('Request too large'); }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally { reader.releaseLock(); }
}
