export async function authorizedCron(request: Request, secret: string | undefined): Promise<boolean> {
  const authorization = request.headers.get('authorization');
  if (!secret || !authorization?.startsWith('Bearer ') || authorization.length > 16384) return false;
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [expected, supplied] = await Promise.all([digest(secret), digest(authorization.slice(7))]);
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected[index] ^ supplied[index];
  return difference === 0;
}
