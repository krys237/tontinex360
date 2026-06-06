/**
 * WS smoke test — vérifie le temps réel du chat de bout en bout, avec le MÊME
 * contrat que l'app mobile (wss://<host>/ws/chat/<id>/?token=<JWT>).
 *
 * Node 18+ (WebSocket + fetch globaux). À lancer depuis tontinex360_mobile/ :
 *
 *   # Mode token (recommandé) :
 *   $env:TX_TOKEN="<access_jwt>"; $env:TX_TENANT="<slug_asso>"; node scripts/ws-smoke-test.mjs
 *
 *   # Mode identifiants :
 *   $env:TX_PHONE="<telephone>"; $env:TX_PASSWORD="<mdp>"; $env:TX_TENANT="<slug_asso>"; node scripts/ws-smoke-test.mjs
 *
 *   # Cible une conversation précise (sinon prend la 1re de la liste) :
 *   $env:TX_CONV="<conversation_id>"
 */
const API = process.env.TX_API ?? 'https://api.tontinex360.com/api';
const WS = process.env.TX_WS ?? 'wss://api.tontinex360.com/ws';
const slug = process.env.TX_TENANT;

function log(...a) {
  console.log(...a);
}

async function main() {
  if (typeof WebSocket === 'undefined') {
    log('❌ WebSocket global absent — utilise Node 20+.');
    process.exit(1);
  }

  let token = process.env.TX_TOKEN;
  if (!token) {
    log('→ Login…');
    const r = await fetch(`${API}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telephone: process.env.TX_PHONE, password: process.env.TX_PASSWORD }),
    });
    const j = await r.json().catch(() => ({}));
    log('  login status', r.status);
    token = j?.tokens?.access;
    if (!token) {
      log('❌ Pas de token. Réponse:', JSON.stringify(j).slice(0, 300));
      process.exit(1);
    }
  }
  if (!slug) {
    log('⚠️  TX_TENANT (slug association) non fourni — les appels /chat/ vont sûrement 403.');
  }

  let convId = process.env.TX_CONV;
  if (!convId) {
    log('→ Liste des conversations…');
    const r = await fetch(`${API}/chat/conversations/`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant': slug ?? '' },
    });
    log('  conversations status', r.status);
    const j = await r.json().catch(() => ({}));
    const list = Array.isArray(j) ? j : j.results ?? [];
    log('  trouvées:', list.map((c) => ({ id: c.id, type: c.conv_type, name: c.name })));
    convId = list[0]?.id;
  }
  if (!convId) {
    log('❌ Aucune conversation. Crée/ouvre une conversation d’abord (ou fournis TX_CONV).');
    process.exit(1);
  }

  const url = `${WS}/chat/${convId}/?token=${encodeURIComponent(token)}`;
  log('→ Connexion WS:', url.replace(token, '<token>'));
  const ws = new WebSocket(url);

  ws.addEventListener('open', () => {
    log('✅ WS OPEN');
    const payload = { type: 'chat.message', content: `Test temps réel ${new Date().toISOString()}` };
    log('→ Envoi:', JSON.stringify(payload));
    ws.send(JSON.stringify(payload));
    // petit typing pour vérifier le canal
    ws.send(JSON.stringify({ type: 'chat.typing', is_typing: true }));
  });
  ws.addEventListener('message', (e) => log('📩 RECV', String(e.data).slice(0, 400)));
  ws.addEventListener('error', (e) => log('⚠️  WS ERROR', e?.message ?? e?.type ?? e));
  ws.addEventListener('close', (e) => log('🔌 WS CLOSE', e.code, e.reason));

  setTimeout(() => {
    log('— fin du test —');
    try { ws.close(); } catch {}
    process.exit(0);
  }, 9000);
}

main().catch((e) => {
  log('❌ Erreur:', e?.message ?? e);
  process.exit(1);
});
