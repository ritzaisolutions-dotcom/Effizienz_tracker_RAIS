## ARBEITSREGEL — KONSERVATIV, STOP BEI FRAGEN

1. Bei jeder Unklarheit: SOFORT STOPPEN. Keine Annahmen treffen.
2. Eine Frage auf einmal stellen, dann auf Antwort warten.
3. Nichts loeschen oder ueberschreiben was eine andere Session gebaut hat, ohne Bestaetigung.
4. Nur umsetzen was in diesem File steht. Keine eigenen Ideen hinzufuegen.
5. Wenn Supabase Key fehlt, Tabelle nicht existiert, oder Code-Konflikt entsteht: SOFORT STOPP und melden.

---
# SESSION 1 — Foundation, Auth & DB Schema
**Arbeitet komplett unabhängig. Kein Warten auf andere Sessions.**
**Wenn fertig: Outputs in `session1_done.md` dokumentieren (Supabase URLs, Auth-User-ID)**

---

## Kontext

Du baust den RAIS Lifestyle Tracker — eine private Standalone-App für Kevin (Founder, RAIS).
Stack: Vanilla HTML/CSS/JS · Supabase · Vercel
Supabase Projekt: `qdywaenmojdxhfxqbvun` (Region: eu-central-1)
Bestehende Tabellen die du NICHT anfasst: `crm_contacts`, `crm_sessions`, `crm_session_events`, `crm_clients`, `wf_runs`, `roi_leads`, `inbound_leads`, `cookie_consents`

---

## Aufgabe 1 — Neue Tabellen anlegen

Führe diese Migrations in Supabase aus:

```sql
-- TABELLE 1: Tracker Sessions (Deep Work + Training)
CREATE TABLE tracker_sessions (
  id               BIGSERIAL PRIMARY KEY,
  type             TEXT NOT NULL CHECK (type IN ('deep_work', 'training')),
  label            TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  total_seconds    INTEGER DEFAULT 0,
  focused_seconds  INTEGER DEFAULT 0,
  paused_seconds   INTEGER GENERATED ALWAYS AS (COALESCE(total_seconds,0) - COALESCE(focused_seconds,0)) STORED,
  is_active        BOOLEAN DEFAULT FALSE,
  is_paused        BOOLEAN DEFAULT FALSE,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tracker_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner only" ON tracker_sessions
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE INDEX idx_tracker_sessions_started ON tracker_sessions(started_at DESC);
CREATE INDEX idx_tracker_sessions_type ON tracker_sessions(type);
CREATE INDEX idx_tracker_sessions_active ON tracker_sessions(is_active) WHERE is_active = TRUE;

-- TABELLE 2: Content Log
CREATE TABLE tracker_content_log (
  id           BIGSERIAL PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('episode', 'short', 'post')),
  platform     TEXT NOT NULL CHECK (platform IN ('eckstein', 'youtube', 'instagram', 'tiktok')),
  title        TEXT,
  published_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tracker_content_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner only" ON tracker_content_log
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE INDEX idx_content_log_published ON tracker_content_log(published_at DESC);
```

**Neuer CRM-Status ergänzen (Migration, kein ALTER — nur Dokumentation):**
Die Werte `demo` und `closing` sind valide Status-Werte in `crm_contacts.status`.
Kein Schema-Change nötig (TEXT Spalte ohne CHECK Constraint).
Dokumentiere nur: diese beiden Werte werden vom Tracker als 🟢 Grün behandelt.

---

## Aufgabe 2 — Supabase Auth User anlegen

1. Gehe zu Supabase Dashboard → Authentication → Users → "Add User"
2. Email: kevins persönliche Email (frag Kevin falls unklar — NICHT hardcoden)
3. Passwort: sicheres Passwort (min 12 Zeichen, Kevin wählt selbst)
4. "Email Confirm" deaktivieren (internes Tool, kein Email-Verify nötig)
5. Notiere die User-UUID — wird von Session 2 benötigt

**Alternativ per SQL:**
```sql
-- Nur ausführen wenn Dashboard-Zugang nicht möglich
SELECT auth.uid(); -- Zum Testen ob Auth funktioniert
```

---

## Aufgabe 3 — HTML Grundstruktur + Auth

Erstelle `index.html` — die komplette App-Shell.

### Anforderungen

**Auth Flow:**
- App startet → prüft Supabase Session
- Keine Session → zeigt Login Screen
- Session vorhanden → zeigt App (Tab-Navigation)
- Supabase Session ist persistent (bleibt nach Browser-Close)

**Design:**
- Dark Theme: Background `#0A0A0A`, Text `#F0F0F0`, Accent `#C8FF00`
- Font: `'Space Mono'` für Timer-Displays (Monospace), `'Outfit'` für UI-Text (beide via Google Fonts)
- Mobile-first, responsive

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>RAIS Tracker</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <style>
    /* CSS VARIABLES */
    :root {
      --bg:       #0A0A0A;
      --surface:  #141618;
      --border:   #222426;
      --text:     #F0F0F0;
      --muted:    #888;
      --accent:   #C8FF00;
      --green:    #22C55E;
      --yellow:   #EAB308;
      --red:      #EF4444;
      --font-ui:  'Outfit', sans-serif;
      --font-mono:'Space Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-ui);
      min-height: 100dvh;
      max-width: 480px;
      margin: 0 auto;
      position: relative;
    }

    /* ── LOGIN SCREEN ── */
    #login-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      padding: 2rem;
      gap: 2rem;
    }

    .login-logo {
      font-family: var(--font-mono);
      font-size: 1.2rem;
      letter-spacing: 0.3em;
      color: var(--accent);
    }

    .login-form {
      width: 100%;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .login-form input {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      color: var(--text);
      font-family: var(--font-ui);
      font-size: 1rem;
      width: 100%;
      outline: none;
      transition: border-color 0.2s;
    }

    .login-form input:focus {
      border-color: var(--accent);
    }

    .btn-primary {
      background: var(--accent);
      color: #000;
      border: none;
      border-radius: 8px;
      padding: 1rem;
      font-family: var(--font-ui);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      letter-spacing: 0.05em;
      transition: opacity 0.2s;
    }

    .btn-primary:hover { opacity: 0.85; }
    .btn-primary:active { opacity: 0.7; }

    .login-error {
      color: var(--red);
      font-size: 0.85rem;
      text-align: center;
      min-height: 1.2em;
    }

    /* ── APP SHELL ── */
    #app-shell { display: none; }
    #app-shell.visible { display: block; }

    /* Top Bar */
    .topbar {
      position: sticky;
      top: 0;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
    }

    .topbar-logo {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      letter-spacing: 0.25em;
      color: var(--accent);
    }

    .btn-logout {
      background: none;
      border: 1px solid var(--border);
      color: var(--muted);
      border-radius: 6px;
      padding: 0.4rem 0.75rem;
      font-size: 0.8rem;
      cursor: pointer;
      font-family: var(--font-ui);
      transition: color 0.2s, border-color 0.2s;
    }
    .btn-logout:hover { color: var(--text); border-color: var(--text); }

    /* Tab Content Area */
    .tab-content {
      padding: 1.25rem;
      padding-bottom: 6rem; /* space for bottom nav */
    }

    /* ── BOTTOM NAV ── */
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 480px;
      background: var(--surface);
      border-top: 1px solid var(--border);
      display: flex;
      z-index: 200;
    }

    .nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.65rem 0.25rem;
      cursor: pointer;
      gap: 0.25rem;
      border: none;
      background: none;
      color: var(--muted);
      font-family: var(--font-ui);
      font-size: 0.65rem;
      letter-spacing: 0.05em;
      transition: color 0.2s;
      -webkit-tap-highlight-color: transparent;
    }

    .nav-item svg { width: 20px; height: 20px; }
    .nav-item.active { color: var(--accent); }

    /* Tab panels */
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    /* ── SHARED COMPONENTS ── */
    .section-title {
      font-size: 0.7rem;
      letter-spacing: 0.15em;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 1rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 0.75rem;
    }

    .hidden { display: none !important; }
  </style>
</head>
<body>

<!-- LOGIN SCREEN -->
<div id="login-screen">
  <div class="login-logo">RAIS TRACKER</div>
  <div class="login-form">
    <input type="email" id="login-email" placeholder="Email" autocomplete="email">
    <input type="password" id="login-password" placeholder="Passwort" autocomplete="current-password">
    <button class="btn-primary" onclick="handleLogin()">Einloggen</button>
    <div class="login-error" id="login-error"></div>
  </div>
</div>

<!-- APP SHELL -->
<div id="app-shell">
  <div class="topbar">
    <span class="topbar-logo">RAIS</span>
    <button class="btn-logout" onclick="handleLogout()">Logout</button>
  </div>

  <div class="tab-content">
    <div class="tab-panel active" id="tab-overview"><!-- Session 2 füllt das --></div>
    <div class="tab-panel" id="tab-deepwork"><!-- Session 2 füllt das --></div>
    <div class="tab-panel" id="tab-training"><!-- Session 3 füllt das --></div>
    <div class="tab-panel" id="tab-outreach"><!-- Session 3 füllt das --></div>
    <div class="tab-panel" id="tab-content"><!-- Session 4 füllt das --></div>
  </div>

  <nav class="bottom-nav">
    <button class="nav-item active" data-tab="overview">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
      Overview
    </button>
    <button class="nav-item" data-tab="deepwork">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      Deep Work
    </button>
    <button class="nav-item" data-tab="training">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 4v16M18 4v16M3 8h18M3 16h18"/>
      </svg>
      Training
    </button>
    <button class="nav-item" data-tab="outreach">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
      </svg>
      Outreach
    </button>
    <button class="nav-item" data-tab="content">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
      Content
    </button>
  </nav>
</div>

<script>
// ── SUPABASE INIT ──
const { createClient } = supabase;
const SB = createClient(
  'https://qdywaenmojdxhfxqbvun.supabase.co',
  'SUPABASE_ANON_KEY_HERE' // Kevin: Anon Key aus Supabase Dashboard → Settings → API
);

// ── AUTH ──
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  const { error } = await SB.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = 'Login fehlgeschlagen. Email oder Passwort falsch.';
  } else {
    showApp();
  }
}

async function handleLogout() {
  await SB.auth.signOut();
  document.getElementById('app-shell').classList.remove('visible');
  document.getElementById('login-screen').style.display = 'flex';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').classList.add('visible');
  initTabs();
  // Sessions laden — wird von Session 2/3/4 implementiert
  if (typeof loadOverview === 'function') loadOverview();
}

// ── TAB NAVIGATION ──
function initTabs() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');
    });
  });
}

// ── BOOT ──
SB.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    showApp();
  }
});

// Enter key auf Login
document.getElementById('login-password')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin();
});
</script>
</body>
</html>
```

---

## Aufgabe 4 — Vercel Projekt anlegen

1. Neues Vercel Projekt erstellen (falls noch kein Repo)
2. Framework: "Other" (statisches HTML)
3. Domain konfigurieren: `tracker.ritz-ai.solutions`
4. Cloudflare DNS: CNAME `tracker` → `cname.vercel-dns.com`
5. `index.html` deployen (auch wenn noch unfertig — damit Domain live ist)

---

## Output dokumentieren (für andere Sessions)
Erstelle `session1_done.md`:
```
- Supabase Tabellen: tracker_sessions ✓, tracker_content_log ✓
- Auth User angelegt: [User UUID hier]
- Anon Key: [hier eintragen]
- Domain live: tracker.ritz-ai.solutions → [ja/nein]
- index.html deployed: [ja/nein]
```
