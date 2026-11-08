import { pathToFileURL } from 'node:url';

export function redirectPatch(config, siteUrl) {
  const origin = new URL(siteUrl).origin;
  if (new URL(origin).protocol !== 'https:') throw new Error('Production auth requires HTTPS');
  const allowed = Array.isArray(config.uri_allow_list)
    ? config.uri_allow_list
    : (config.uri_allow_list ?? '').split(',').map((url) => url.trim()).filter(Boolean);
  const required = [`${origin}/auth`, `${origin}/auth?overlay=true`];
  const patch = {};
  if (config.site_url !== origin) patch.site_url = origin;
  if (required.some((url) => !allowed.includes(url))) patch.uri_allow_list = [...new Set([...allowed, ...required])].join(',');
  return patch;
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref || !/^[a-z0-9]+$/.test(ref)) throw new Error('Missing Supabase deployment credentials');
  const endpoint = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const response = await fetch(endpoint, { headers });
  if (!response.ok) throw new Error(`Cannot read auth config: HTTP ${response.status}`);
  const config = await response.json();
  const siteUrl = process.env.VITE_WEB_URL || 'https://aura.aura-companion.workers.dev';
  console.log(`Verifying OAuth return URLs for ${new URL(siteUrl).origin}`);
  const patch = redirectPatch(config, siteUrl);
  if (Object.keys(patch).length) {
    const result = await fetch(endpoint, { method: 'PATCH', headers, body: JSON.stringify(patch) });
    if (!result.ok) throw new Error(`Cannot update auth redirects: HTTP ${result.status}`);
    console.log('OAuth return URLs repaired; existing allowed URLs preserved.');
  } else {
    console.log('OAuth return URLs already correct.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
