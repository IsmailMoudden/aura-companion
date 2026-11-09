export function dashboardPage(failed = false): string {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <title>Aura</title><style>
  body{margin:0;background:#1a2535;color:#e5edf5;font:16px system-ui;display:grid;min-height:100vh;place-items:center}
  main{text-align:center;max-width:440px;padding:32px}h1{font-weight:400;font-size:26px}p{color:#a7bacd;line-height:1.6}
  a{display:inline-block;color:#d5edff;padding:12px 18px;margin:8px;border:1px solid #52677b;border-radius:24px;text-decoration:none}
  </style><main><h1>${failed ? 'Ton espace est indisponible' : 'Ouverture de ton espace…'}</h1>
  <p>${failed ? 'La page n’a pas pu se charger. Vérifie ta connexion, puis réessaie ou ouvre Aura dans ton navigateur.' : 'Aura se connecte à ton espace. Cela peut prendre quelques secondes.'}</p>
  <a href="aura-dashboard:retry">Réessayer</a><a href="aura-dashboard:browser">Ouvrir dans le navigateur</a></main></html>`;
}
