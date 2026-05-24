## ARBEITSREGEL — KONSERVATIV, STOP BEI FRAGEN

1. Bei jeder Unklarheit: SOFORT STOPPEN. Keine Annahmen treffen.
2. Eine Frage auf einmal stellen, dann auf Antwort warten.
3. Nichts loeschen oder ueberschreiben was eine andere Session gebaut hat, ohne Bestaetigung.
4. Nur umsetzen was in diesem File steht. Keine eigenen Ideen hinzufuegen.
5. Wenn Supabase Key fehlt, Tabelle nicht existiert, oder Code-Konflikt entsteht: SOFORT STOPP und melden.

---
# SESSION 4 — Content Tab + Polish + Deploy
**Voraussetzung: Sessions 1-3 müssen fertig sein. Läuft als letztes oder parallel zu Session 3.**
**Abschließende Session — deployt das fertige Produkt.**

---

## Kontext

Du ergänzt `index.html` um:
- `#tab-content` — Manueller Content-Log (Podcast Episodes, Shorts, Posts)

Dann übernimmst du das vollständige Polish + Vercel Deploy.

Supabase: `qdywaenmojdxhfxqbvun`
Tabelle: `tracker_content_log`

---

## Aufgabe 1 — Content Tab

### Datenstruktur
```javascript
const CONTENT_TYPES = ['episode', 'short', 'post'];
const CONTENT_PLATFORMS = ['eckstein', 'youtube', 'instagram', 'tiktok'];
const PLATFORM_LABELS = {
  eckstein: 'Eckstein Podcast',
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok'
};
const TYPE_LABELS = {
  episode: 'Episode',
  short: 'Short',
  post: 'Post'
};
const TYPE_ICONS = { episode: '🎙', short: '📱', post: '📝' };
```

### Eintrag hinzufügen (max 10 Sekunden Flow)

```javascript
let contentType = null;
let contentPlatform = null;

async function saveContent() {
  if (!contentType || !contentPlatform) return;
  const title = document.getElementById('content-title-input').value.trim() || null;
  const { data: { user } } = await SB.auth.getUser();

  const { error } = await SB.from('tracker_content_log').insert({
    type: contentType,
    platform: contentPlatform,
    title: title,
    published_at: new Date().toISOString().split('T')[0],
    created_by: user.id
  });

  if (!error) {
    // Reset
    contentType = null;
    contentPlatform = null;
    document.getElementById('content-title-input').value = '';
    document.getElementById('content-save-btn').disabled = true;
    document.getElementById('content-save-btn').style.opacity = '0.4';
    // Deselect all buttons
    document.querySelectorAll('.content-type-btn, .content-platform-btn').forEach(b => {
      b.style.borderColor = 'var(--border)';
      b.style.color = 'var(--muted)';
      b.style.background = 'transparent';
    });
    loadContentLog();
  }
}

function selectContentType(type) {
  contentType = type;
  document.querySelectorAll('.content-type-btn').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.color = 'var(--muted)';
    b.style.background = 'transparent';
  });
  const btn = document.getElementById('ctype-' + type);
  btn.style.borderColor = 'var(--accent)';
  btn.style.color = 'var(--accent)';
  btn.style.background = 'rgba(200,255,0,0.08)';
  checkContentReady();
}

function selectContentPlatform(platform) {
  contentPlatform = platform;
  document.querySelectorAll('.content-platform-btn').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.color = 'var(--muted)';
    b.style.background = 'transparent';
  });
  const btn = document.getElementById('cplatform-' + platform);
  btn.style.borderColor = 'var(--accent)';
  btn.style.color = 'var(--accent)';
  btn.style.background = 'rgba(200,255,0,0.08)';
  checkContentReady();
}

function checkContentReady() {
  const btn = document.getElementById('content-save-btn');
  if (contentType && contentPlatform) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  }
}

async function loadContentLog() {
  const weekStart = getWeekStart();
  const { data } = await SB.from('tracker_content_log')
    .select('*')
    .gte('published_at', weekStart)
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  const list = document.getElementById('content-log-list');
  const counter = document.getElementById('content-week-count');

  counter.textContent = `${(data || []).length} Pieces diese Woche`;

  if (!data || data.length === 0) {
    list.innerHTML = '<div style="color:var(--muted); font-size:0.85rem;">Noch nichts published diese Woche.</div>';
    return;
  }

  list.innerHTML = data.map(r => `
    <div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:0.85rem 1rem;">
      <div>
        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.2rem;">
          <span>${TYPE_ICONS[r.type]}</span>
          <span style="font-size:0.85rem; font-weight:500;">${TYPE_LABELS[r.type]}</span>
          <span style="font-size:0.7rem; color:var(--muted);">· ${PLATFORM_LABELS[r.platform]}</span>
        </div>
        ${r.title ? `<div style="font-size:0.75rem; color:var(--muted);">${r.title}</div>` : ''}
      </div>
      <div style="font-size:0.7rem; color:var(--muted); white-space:nowrap;">
        ${new Date(r.published_at + 'T12:00:00').toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit'})}
      </div>
    </div>
  `).join('');
}
```

### HTML für Content Tab

Füge in `#tab-content` ein:

```html
<div class="section-title">Content veröffentlicht</div>

<!-- Quick-Add Card -->
<div class="card" style="margin-bottom:1.25rem;">
  <div style="font-size:0.7rem; color:var(--muted); letter-spacing:0.12em; margin-bottom:0.75rem;">TYP</div>
  <div style="display:flex; gap:0.5rem; margin-bottom:1rem;">
    <button class="content-type-btn" id="ctype-episode" onclick="selectContentType('episode')"
      style="flex:1; padding:0.65rem 0.25rem; background:transparent; border:1px solid var(--border);
             border-radius:8px; color:var(--muted); font-family:var(--font-ui); font-size:0.8rem; cursor:pointer;">
      🎙 Episode
    </button>
    <button class="content-type-btn" id="ctype-short" onclick="selectContentType('short')"
      style="flex:1; padding:0.65rem 0.25rem; background:transparent; border:1px solid var(--border);
             border-radius:8px; color:var(--muted); font-family:var(--font-ui); font-size:0.8rem; cursor:pointer;">
      📱 Short
    </button>
    <button class="content-type-btn" id="ctype-post" onclick="selectContentType('post')"
      style="flex:1; padding:0.65rem 0.25rem; background:transparent; border:1px solid var(--border);
             border-radius:8px; color:var(--muted); font-family:var(--font-ui); font-size:0.8rem; cursor:pointer;">
      📝 Post
    </button>
  </div>

  <div style="font-size:0.7rem; color:var(--muted); letter-spacing:0.12em; margin-bottom:0.75rem;">PLATTFORM</div>
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:1rem;">
    <button class="content-platform-btn" id="cplatform-eckstein" onclick="selectContentPlatform('eckstein')"
      style="padding:0.65rem; background:transparent; border:1px solid var(--border);
             border-radius:8px; color:var(--muted); font-family:var(--font-ui); font-size:0.8rem; cursor:pointer;">
      Eckstein Podcast
    </button>
    <button class="content-platform-btn" id="cplatform-youtube" onclick="selectContentPlatform('youtube')"
      style="padding:0.65rem; background:transparent; border:1px solid var(--border);
             border-radius:8px; color:var(--muted); font-family:var(--font-ui); font-size:0.8rem; cursor:pointer;">
      YouTube
    </button>
    <button class="content-platform-btn" id="cplatform-instagram" onclick="selectContentPlatform('instagram')"
      style="padding:0.65rem; background:transparent; border:1px solid var(--border);
             border-radius:8px; color:var(--font-ui); font-size:0.8rem; cursor:pointer;">
      Instagram
    </button>
    <button class="content-platform-btn" id="cplatform-tiktok" onclick="selectContentPlatform('tiktok')"
      style="padding:0.65rem; background:transparent; border:1px solid var(--border);
             border-radius:8px; color:var(--muted); font-family:var(--font-ui); font-size:0.8rem; cursor:pointer;">
      TikTok
    </button>
  </div>

  <input type="text" id="content-title-input" placeholder="Titel (optional)"
    style="background:var(--bg); border:1px solid var(--border); border-radius:8px;
           padding:0.75rem; color:var(--text); font-family:var(--font-ui);
           font-size:0.9rem; width:100%; margin-bottom:1rem; outline:none;">

  <button id="content-save-btn" onclick="saveContent()" disabled
    style="width:100%; background:var(--accent); border:none; border-radius:8px;
           padding:1rem; color:#000; font-family:var(--font-ui); font-weight:600;
           font-size:0.95rem; cursor:not-allowed; opacity:0.4;">
    + Speichern
  </button>
</div>

<!-- Log -->
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
  <div class="section-title" style="margin-bottom:0;">DIESE WOCHE</div>
  <div id="content-week-count" style="font-size:0.75rem; color:var(--muted);"></div>
</div>
<div id="content-log-list"></div>
```

---

## Aufgabe 2 — Global Polish

### PWA Manifest (Add to Homescreen)
Füge im `<head>` ein:
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0A0A0A">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="RAIS Tracker">
```

Erstelle `manifest.json` im Root:
```json
{
  "name": "RAIS Tracker",
  "short_name": "RAIS",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0A0A0A",
  "theme_color": "#0A0A0A",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Erstelle simple Icons (192x192 und 512x512) mit Canvas oder einem SVG-to-PNG Tool:
- Hintergrund: `#0A0A0A`
- Text: "R" in `#C8FF00`, Font: Space Mono Bold
- Oder: Nutze einen online Favicon-Generator mit dem Text "R"

### Tab-Wechsel Init ergänzen

Stelle sicher dass beim ersten Load und bei jedem Tab-Wechsel die richtigen Daten geladen werden:

```javascript
// In showApp() ergänzen:
function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').classList.add('visible');
  initTabs();
  loadOverview();
  loadDWToday();
  loadTRToday();
  // Outreach und Content werden beim Tab-Wechsel lazy geladen
}
```

### Keyboard + UX Details
```javascript
// Enter = Login
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin();
});

// Prevent double-tap zoom auf Buttons (iOS)
document.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('touchend', e => e.preventDefault());
});

// Active Session Recovery nach Page Reload
async function recoverActiveSession() {
  const { data: { user } } = await SB.auth.getUser();
  if (!user) return;
  
  const { data } = await SB.from('tracker_sessions')
    .select('*')
    .eq('is_active', true)
    .eq('created_by', user.id)
    .single();

  if (data) {
    // Aktive Session gefunden — bereinigen (wurde durch Reload beendet)
    const elapsed = Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000);
    await SB.from('tracker_sessions').update({
      is_active: false,
      ended_at: new Date().toISOString(),
      total_seconds: elapsed,
      focused_seconds: Math.floor(elapsed * 0.9), // Schätzung
    }).eq('id', data.id);
  }
}
// In showApp() aufrufen: recoverActiveSession();
```

---

## Aufgabe 3 — Vercel Deploy

### vercel.json erstellen
```json
{
  "version": 2,
  "builds": [
    { "src": "*.html", "use": "@vercel/static" },
    { "src": "manifest.json", "use": "@vercel/static" },
    { "src": "*.png", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "/$1" }
  ]
}
```

### Deploy Steps
1. `vercel login` (falls nicht eingeloggt)
2. `vercel --prod` im Projektordner
3. Custom Domain: `vercel domains add tracker.ritz-ai.solutions`
4. Cloudflare DNS: CNAME Record `tracker` → `cname.vercel-dns.com` (Proxy: OFF / DNS-only)
5. Warte 2-5 Minuten → Domain live testen

### ⚠️ GDPR Reminder
Diese App ist rein privat/intern (nur Kevin als User) und erfasst keine Daten von Dritten.
Kein Cookie Banner nötig — kein Tracking, keine Analytics, kein Marketing.
Einzige Ausnahme: Falls Google Fonts per CDN geladen werden, gibt es theoretisch einen DSGVO-Graubereich.
**Fix:** Google Fonts lokal hosten oder font-display: swap + self-hosted verwenden.

Lade Fonts lokal herunter:
- Space Mono: https://fonts.google.com/specimen/Space+Mono → Download Family
- Outfit: https://fonts.google.com/specimen/Outfit → Download Family
- In `/fonts/` ablegen, CSS `@font-face` statt Google Fonts CDN verwenden

---

## Aufgabe 4 — Finaler Smoke Test

Checke jeden Punkt durch bevor du done.md schreibst:

```
SMOKE TEST CHECKLIST:
[ ] Login funktioniert (Email + Passwort)
[ ] Session bleibt nach Browser-Close persistiert
[ ] Deep Work: Start → Pause → Resume → End → Save → in Today-Liste sichtbar
[ ] Training: Muskel wählen → Start → Pause → End → Save → in Today-Liste sichtbar
[ ] Outreach: Zeigt Session vom 22.5.2026 korrekt an (11 Leads, kein_anschluss/disqualified)
[ ] Ampel: kein_anschluss = Rot ✓, door_open = Warm (helles Grün) ✓
[ ] Content: Episode + Eckstein → Speichern → in Liste sichtbar
[ ] Overview: Alle 4 KPI Cards laden korrekt
[ ] Wochenbalken auf Overview zeigt Daten
[ ] Mobile: Bottom Nav scrollt nicht weg
[ ] iOS: Add to Homescreen zeigt Icon und läuft Standalone
[ ] Vercel: tracker.ritz-ai.solutions erreichbar (HTTPS)
[ ] RLS: Ohne Login kein Datenzugriff möglich
```

---

## Output dokumentieren
Erstelle `session4_done.md`:
```
- Content Tab: ✓
- PWA Manifest: ✓
- Vercel deployed: [URL]
- Domain live: [ja/nein]
- Smoke Test: [X/17 bestanden]
- Offene Bugs: [Liste]
```
