## ARBEITSREGEL — KONSERVATIV, STOP BEI FRAGEN

1. Bei jeder Unklarheit: SOFORT STOPPEN. Keine Annahmen treffen.
2. Eine Frage auf einmal stellen, dann auf Antwort warten.
3. Nichts loeschen oder ueberschreiben was eine andere Session gebaut hat, ohne Bestaetigung.
4. Nur umsetzen was in diesem File steht. Keine eigenen Ideen hinzufuegen.
5. Wenn Supabase Key fehlt, Tabelle nicht existiert, oder Code-Konflikt entsteht: SOFORT STOPP und melden.

---
# SESSION 2 — Deep Work Tab + Overview Tab
**Voraussetzung: Session 1 muss `tracker_sessions` Tabelle angelegt haben.**
**Arbeitet auf der `index.html` die Session 1 erstellt hat.**
**Wenn fertig: `session2_done.md` erstellen.**

---

## Kontext

Du ergänzt die `index.html` des RAIS Lifestyle Trackers um zwei Tabs:
- `#tab-deepwork` — Timer-Interface für Fokus-Sessions
- `#tab-overview` — Dashboard mit allen KPIs

Supabase: `qdywaenmojdxhfxqbvun`
Tabelle: `tracker_sessions` (type IN ('deep_work', 'training'))

Design-System (bereits in CSS definiert von Session 1):
- `--bg: #0A0A0A` · `--surface: #141618` · `--accent: #C8FF00`
- `--green: #22C55E` · `--yellow: #EAB308` · `--red: #EF4444`
- Font: `'Space Mono'` für Timer · `'Outfit'` für UI

---

## Aufgabe 1 — Deep Work Tab

### Timer-Logik (kritisch)

Zwei vollständig unabhängige Zähler:

```javascript
// STATE
let dwState = 'idle'; // 'idle' | 'active' | 'paused'
let dwTotalSeconds = 0;
let dwFocusedSeconds = 0;
let dwTotalInterval = null;
let dwFocusInterval = null;
let dwStartedAt = null;
let dwCurrentSessionId = null; // Supabase ID der aktiven Session

function dwStart() {
  dwState = 'active';
  dwStartedAt = new Date();
  dwTotalSeconds = 0;
  dwFocusedSeconds = 0;

  // Beide Timer starten
  dwTotalInterval = setInterval(() => {
    dwTotalSeconds++;
    renderDWTimers();
  }, 1000);
  dwFocusInterval = setInterval(() => {
    dwFocusedSeconds++;
  }, 1000);

  // Session in Supabase anlegen
  dwCreateSession();
  renderDWState();
}

function dwPause() {
  if (dwState !== 'active') return;
  dwState = 'paused';
  clearInterval(dwFocusInterval); // Fokus stoppt
  // dwTotalInterval läuft weiter
  renderDWState();
}

function dwResume() {
  if (dwState !== 'paused') return;
  dwState = 'active';
  dwFocusInterval = setInterval(() => {
    dwFocusedSeconds++;
  }, 1000);
  renderDWState();
}

function dwEnd() {
  clearInterval(dwTotalInterval);
  clearInterval(dwFocusInterval);
  dwState = 'idle';
  showDWSummaryModal();
}

// Render Timer Display
function renderDWTimers() {
  document.getElementById('dw-total').textContent = formatTime(dwTotalSeconds);
  document.getElementById('dw-focus').textContent = formatTime(dwFocusedSeconds);
  document.getElementById('dw-pause').textContent = formatTime(dwTotalSeconds - dwFocusedSeconds);
}

function formatTime(s) {
  const h = Math.floor(s / 3600).toString().padStart(2, '0');
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${h}:${m}:${sec}`;
}
```

### Supabase: Session anlegen + abschließen

```javascript
async function dwCreateSession() {
  const { data: { user } } = await SB.auth.getUser();
  const { data } = await SB.from('tracker_sessions').insert({
    type: 'deep_work',
    started_at: dwStartedAt.toISOString(),
    is_active: true,
    is_paused: false,
    created_by: user.id
  }).select('id').single();
  dwCurrentSessionId = data.id;
}

async function dwSaveSession(label) {
  if (!dwCurrentSessionId) return;
  await SB.from('tracker_sessions').update({
    ended_at: new Date().toISOString(),
    total_seconds: dwTotalSeconds,
    focused_seconds: dwFocusedSeconds,
    label: label || null,
    is_active: false,
    is_paused: false
  }).eq('id', dwCurrentSessionId);
  dwCurrentSessionId = null;
  loadDWToday(); // Liste neu laden
  loadOverview(); // Overview aktualisieren
}

async function dwDiscardSession() {
  if (!dwCurrentSessionId) return;
  await SB.from('tracker_sessions').delete().eq('id', dwCurrentSessionId);
  dwCurrentSessionId = null;
}
```

### HTML für Deep Work Tab

Füge in `#tab-deepwork` ein:

```html
<!-- IDLE STATE -->
<div id="dw-idle" class="dw-state">
  <div class="section-title">Deep Work Session</div>
  <div class="card" style="text-align:center; padding: 2.5rem 1.25rem;">
    <div style="font-size:0.8rem; color:var(--muted); margin-bottom:2rem; letter-spacing:0.1em;">
      BEREIT ZU STARTEN
    </div>
    <button class="btn-primary" onclick="dwStart()" style="max-width:200px; margin:0 auto;">
      ▶ SESSION STARTEN
    </button>
  </div>
  <div class="section-title" style="margin-top:1.5rem;">HEUTE</div>
  <div id="dw-today-list"></div>
  <div id="dw-today-total" style="color:var(--muted); font-size:0.85rem; margin-top:0.5rem;"></div>
</div>

<!-- ACTIVE/PAUSED STATE -->
<div id="dw-running" class="dw-state hidden">
  <div class="card">
    <!-- Timer Display -->
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; text-align:center; margin-bottom:1.5rem;">
      <div>
        <div style="font-size:0.6rem; letter-spacing:0.15em; color:var(--muted); margin-bottom:0.4rem;">GESAMT</div>
        <div id="dw-total" style="font-family:var(--font-mono); font-size:1.4rem; color:var(--text);">00:00:00</div>
      </div>
      <div>
        <div style="font-size:0.6rem; letter-spacing:0.15em; color:var(--accent); margin-bottom:0.4rem;">FOKUS</div>
        <div id="dw-focus" style="font-family:var(--font-mono); font-size:1.4rem; color:var(--accent);">00:00:00</div>
      </div>
      <div>
        <div style="font-size:0.6rem; letter-spacing:0.15em; color:var(--muted); margin-bottom:0.4rem;">PAUSE</div>
        <div id="dw-pause" style="font-family:var(--font-mono); font-size:1.4rem; color:var(--muted);">00:00:00</div>
      </div>
    </div>

    <!-- Status Indicator -->
    <div id="dw-status-indicator" style="text-align:center; font-size:0.75rem; letter-spacing:0.15em; color:var(--accent); margin-bottom:1.5rem;">
      ● AKTIV
    </div>

    <!-- Label -->
    <input type="text" id="dw-label-input" placeholder="Label (optional) — z.B. CRM Bugfix"
      style="background:var(--bg); border:1px solid var(--border); border-radius:8px;
             padding:0.75rem; color:var(--text); font-family:var(--font-ui);
             font-size:0.9rem; width:100%; margin-bottom:1rem; outline:none;">

    <!-- Buttons -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
      <button id="dw-pause-btn" onclick="dwTogglePause()"
        style="background:var(--surface); border:1px solid var(--border); border-radius:8px;
               padding:1rem; color:var(--text); font-family:var(--font-ui); font-size:0.9rem;
               cursor:pointer; font-weight:500;">
        ⏸ PAUSE
      </button>
      <button onclick="dwEnd()"
        style="background:transparent; border:1px solid var(--red); border-radius:8px;
               padding:1rem; color:var(--red); font-family:var(--font-ui); font-size:0.9rem;
               cursor:pointer; font-weight:500;">
        ⏹ BEENDEN
      </button>
    </div>
  </div>
</div>

<!-- SUMMARY MODAL -->
<div id="dw-summary-modal" class="hidden"
  style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:300;
         display:flex; align-items:flex-end; justify-content:center;">
  <div style="background:var(--surface); border-radius:16px 16px 0 0; padding:2rem;
              width:100%; max-width:480px; border-top:1px solid var(--border);">
    <div style="font-size:0.7rem; letter-spacing:0.2em; color:var(--muted); margin-bottom:1.5rem;">
      SESSION ZUSAMMENFASSUNG
    </div>
    <div id="dw-summary-content" style="margin-bottom:1.5rem;"></div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
      <button onclick="dwDiscard()"
        style="background:transparent; border:1px solid var(--border); border-radius:8px;
               padding:1rem; color:var(--muted); font-family:var(--font-ui); cursor:pointer;">
        Verwerfen
      </button>
      <button onclick="dwSave()"
        style="background:var(--accent); border:none; border-radius:8px;
               padding:1rem; color:#000; font-family:var(--font-ui);
               font-weight:600; cursor:pointer;">
        Speichern
      </button>
    </div>
  </div>
</div>
```

### Logik für State-Wechsel

```javascript
function renderDWState() {
  const idle = document.getElementById('dw-idle');
  const running = document.getElementById('dw-running');
  const pauseBtn = document.getElementById('dw-pause-btn');
  const statusEl = document.getElementById('dw-status-indicator');

  if (dwState === 'idle') {
    idle.classList.remove('hidden');
    running.classList.add('hidden');
  } else {
    idle.classList.add('hidden');
    running.classList.remove('hidden');
  }

  if (dwState === 'paused') {
    pauseBtn.textContent = '▶ WEITER';
    statusEl.style.color = 'var(--yellow)';
    statusEl.textContent = '⏸ PAUSIERT';
  } else {
    pauseBtn.textContent = '⏸ PAUSE';
    statusEl.style.color = 'var(--accent)';
    statusEl.textContent = '● AKTIV';
  }
}

function dwTogglePause() {
  if (dwState === 'active') dwPause();
  else if (dwState === 'paused') dwResume();
}

function showDWSummaryModal() {
  const pct = dwTotalSeconds > 0
    ? Math.round((dwFocusedSeconds / dwTotalSeconds) * 100)
    : 0;
  document.getElementById('dw-summary-content').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--muted)">Gesamt</span>
        <span style="font-family:var(--font-mono)">${formatTime(dwTotalSeconds)}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--accent)">Fokus</span>
        <span style="font-family:var(--font-mono); color:var(--accent)">${formatTime(dwFocusedSeconds)} (${pct}%)</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--muted)">Pause</span>
        <span style="font-family:var(--font-mono); color:var(--muted)">${formatTime(dwTotalSeconds - dwFocusedSeconds)} (${100-pct}%)</span>
      </div>
      ${document.getElementById('dw-label-input').value ? `
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--muted)">Label</span>
        <span>${document.getElementById('dw-label-input').value}</span>
      </div>` : ''}
    </div>
  `;
  document.getElementById('dw-summary-modal').classList.remove('hidden');
}

async function dwSave() {
  document.getElementById('dw-summary-modal').classList.add('hidden');
  const label = document.getElementById('dw-label-input').value;
  await dwSaveSession(label);
  document.getElementById('dw-label-input').value = '';
  renderDWState();
}

async function dwDiscard() {
  document.getElementById('dw-summary-modal').classList.add('hidden');
  await dwDiscardSession();
  dwTotalSeconds = 0;
  dwFocusedSeconds = 0;
  renderDWTimers();
  renderDWState();
}
```

### Today-Liste laden

```javascript
async function loadDWToday() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await SB.from('tracker_sessions')
    .select('*')
    .eq('type', 'deep_work')
    .eq('is_active', false)
    .gte('started_at', today + 'T00:00:00+00:00')
    .order('started_at', { ascending: false });

  const list = document.getElementById('dw-today-list');
  const total = document.getElementById('dw-today-total');

  if (!data || data.length === 0) {
    list.innerHTML = '<div style="color:var(--muted); font-size:0.85rem;">Noch keine Sessions heute.</div>';
    total.textContent = '';
    return;
  }

  const totalFocus = data.reduce((s, r) => s + (r.focused_seconds || 0), 0);

  list.innerHTML = data.map(r => `
    <div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:0.85rem 1rem;">
      <div>
        <div style="font-size:0.85rem; margin-bottom:0.2rem;">${r.label || '—'}</div>
        <div style="font-size:0.7rem; color:var(--muted);">${new Date(r.started_at).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:var(--font-mono); font-size:0.9rem; color:var(--accent);">${formatTime(r.focused_seconds || 0)}</div>
        <div style="font-size:0.65rem; color:var(--muted);">fokus</div>
      </div>
    </div>
  `).join('');

  total.innerHTML = `<span style="color:var(--text)">Heute gesamt: </span><span style="font-family:var(--font-mono); color:var(--accent);">${formatTime(totalFocus)}</span> fokus`;
}
```

---

## Aufgabe 2 — Overview Tab

Zeigt KPIs aus allen 4 Bereichen aggregiert.

```javascript
async function loadOverview() {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart(); // Montag dieser Woche

  // 1. Deep Work heute
  const { data: dwToday } = await SB.from('tracker_sessions')
    .select('focused_seconds')
    .eq('type', 'deep_work')
    .eq('is_active', false)
    .gte('started_at', today + 'T00:00:00+00:00');

  const dwTodayTotal = (dwToday || []).reduce((s, r) => s + (r.focused_seconds || 0), 0);

  // 2. Training heute
  const { data: trainToday } = await SB.from('tracker_sessions')
    .select('focused_seconds, label')
    .eq('type', 'training')
    .eq('is_active', false)
    .gte('started_at', today + 'T00:00:00+00:00');

  const trainTodayTotal = (trainToday || []).reduce((s, r) => s + (r.focused_seconds || 0), 0);

  // 3. Calls heute (read-only aus crm_sessions)
  const { data: callsToday } = await SB.from('crm_sessions')
    .select('leads_played, status_breakdown')
    .gte('started_at', today + 'T00:00:00+00:00');

  const callsTodayPlayed = (callsToday || []).reduce((s, r) => s + (r.leads_played || 0), 0);

  // 4. Content diese Woche
  const { data: contentWeek } = await SB.from('tracker_content_log')
    .select('type, platform')
    .gte('published_at', weekStart);

  const contentCount = (contentWeek || []).length;

  // 5. Wochendaten für Balkendiagramm
  const { data: dwWeek } = await SB.from('tracker_sessions')
    .select('started_at, focused_seconds, type')
    .eq('is_active', false)
    .gte('started_at', weekStart + 'T00:00:00+00:00')
    .order('started_at');

  renderOverview({
    dwTodayTotal, trainTodayTotal, callsTodayPlayed, contentCount,
    dwWeek: dwWeek || []
  });
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Montag
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function renderOverview({ dwTodayTotal, trainTodayTotal, callsTodayPlayed, contentCount, dwWeek }) {
  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  // Wochenbalken berechnen
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const dwByDay = [0,0,0,0,0,0,0];
  const trainByDay = [0,0,0,0,0,0,0];

  dwWeek.forEach(r => {
    const d = new Date(r.started_at);
    const dayIdx = (d.getDay() + 6) % 7; // 0=Mo
    if (r.type === 'deep_work') dwByDay[dayIdx] += (r.focused_seconds || 0);
    else trainByDay[dayIdx] += (r.focused_seconds || 0);
  });

  const maxSeconds = Math.max(...dwByDay.map((v, i) => v + trainByDay[i]), 1);

  const barsHtml = days.map((d, i) => {
    const dwH = Math.round((dwByDay[i] / maxSeconds) * 80);
    const trainH = Math.round((trainByDay[i] / maxSeconds) * 80);
    const isToday = i === (new Date().getDay() + 6) % 7;
    return `
      <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex:1;">
        <div style="display:flex; flex-direction:column; justify-content:flex-end; height:80px; width:100%; gap:2px;">
          ${dwH > 0 ? `<div style="background:var(--accent); height:${dwH}px; border-radius:3px 3px 0 0; opacity:0.9;"></div>` : ''}
          ${trainH > 0 ? `<div style="background:var(--green); height:${trainH}px; border-radius:${dwH > 0 ? '0' : '3px 3px 0 0'} 0 0;"></div>` : ''}
          ${dwH === 0 && trainH === 0 ? `<div style="background:var(--border); height:3px; border-radius:2px; margin-top:auto;"></div>` : ''}
        </div>
        <div style="font-size:0.6rem; color:${isToday ? 'var(--accent)' : 'var(--muted)'}; letter-spacing:0.05em;">${d}</div>
      </div>
    `;
  }).join('');

  // Effizienz-Daten laden (Deep Work + Training kombiniert)
  const { data: allSessionsToday } = await SB.from('tracker_sessions')
    .select('total_seconds, focused_seconds')
    .eq('is_active', false)
    .gte('started_at', today + 'T00:00:00+00:00');

  const { data: allSessionsWeek } = await SB.from('tracker_sessions')
    .select('total_seconds, focused_seconds')
    .eq('is_active', false)
    .gte('started_at', weekStart + 'T00:00:00+00:00');

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split('T')[0];
  const { data: allSessionsMonth } = await SB.from('tracker_sessions')
    .select('total_seconds, focused_seconds')
    .eq('is_active', false)
    .gte('started_at', monthStart + 'T00:00:00+00:00');

  function calcEffizienz(sessions) {
    const total   = (sessions || []).reduce((s, r) => s + (r.total_seconds   || 0), 0);
    const focused = (sessions || []).reduce((s, r) => s + (r.focused_seconds || 0), 0);
    const lost    = total - focused;
    const pct     = total > 0 ? Math.round((focused / total) * 100) : null;
    return { total, focused, lost, pct };
  }

  const effHeute = calcEffizienz(allSessionsToday);
  const effWoche = calcEffizienz(allSessionsWeek);
  const effMonat = calcEffizienz(allSessionsMonth);

  function effCol(label, eff) {
    const pctColor = eff.pct === null
      ? 'var(--muted)'
      : eff.pct >= 75 ? 'var(--green)'
      : eff.pct >= 55 ? 'var(--yellow)'
      : 'var(--red)';
    return `
      <div style="flex:1; text-align:center;">
        <div style="font-size:0.6rem; letter-spacing:0.1em; color:var(--muted); margin-bottom:0.6rem; text-transform:uppercase;">${label}</div>
        <div style="font-size:0.75rem; color:var(--accent); font-family:var(--font-mono); margin-bottom:0.25rem;">${formatTime(eff.focused)}</div>
        <div style="font-size:0.65rem; color:var(--red); font-family:var(--font-mono); margin-bottom:0.4rem;">${formatTime(eff.lost)} verloren</div>
        <div style="font-size:1rem; font-weight:700; color:${pctColor}; font-family:var(--font-mono);">${eff.pct !== null ? eff.pct + '%' : '—'}</div>
      </div>
    `;
  }

  document.getElementById('tab-overview').innerHTML = `
    <div style="margin-bottom:0.5rem; color:var(--muted); font-size:0.7rem; letter-spacing:0.1em; text-transform:uppercase;">
      ${today}
    </div>

    <!-- Effizienz Block — Kernmetrik -->
    <div class="card" style="margin-bottom:0.75rem;">
      <div class="section-title">EFFIZIENZ</div>
      <div style="display:flex; gap:0.25rem; align-items:flex-start;">
        ${effCol('Heute', effHeute)}
        <div style="width:1px; background:var(--border); align-self:stretch;"></div>
        ${effCol('Woche', effWoche)}
        <div style="width:1px; background:var(--border); align-self:stretch;"></div>
        ${effCol('Monat', effMonat)}
      </div>
    </div>

    <!-- KPI Cards heute -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:1.25rem;">
      ${kpiCard('Deep Work', formatTime(dwTodayTotal), 'fokus', 'var(--accent)')}
      ${kpiCard('Training', formatTime(trainTodayTotal), 'aktiv', 'var(--green)')}
      ${kpiCard('Calls', callsTodayPlayed.toString(), 'gespielt', 'var(--text)')}
      ${kpiCard('Content', contentCount.toString(), 'diese Woche', 'var(--text)')}
    </div>

    <!-- Wochendiagramm -->
    <div class="card">
      <div class="section-title">DIESE WOCHE</div>
      <div style="display:flex; gap:0.5rem; align-items:flex-end; padding:0 0.25rem;">
        ${barsHtml}
      </div>
      <div style="display:flex; gap:1rem; margin-top:0.75rem;">
        <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.65rem; color:var(--muted);">
          <div style="width:10px; height:10px; background:var(--accent); border-radius:2px;"></div>
          Deep Work
        </div>
        <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.65rem; color:var(--muted);">
          <div style="width:10px; height:10px; background:var(--green); border-radius:2px;"></div>
          Training
        </div>
      </div>
    </div>
  `;
}

function kpiCard(title, value, sub, color) {
  return `
    <div class="card" style="text-align:center;">
      <div style="font-size:0.6rem; letter-spacing:0.12em; color:var(--muted); text-transform:uppercase; margin-bottom:0.5rem;">${title}</div>
      <div style="font-family:var(--font-mono); font-size:1.5rem; color:${color}; line-height:1;">${value}</div>
      <div style="font-size:0.65rem; color:var(--muted); margin-top:0.25rem;">${sub}</div>
    </div>
  `;
}
```

---

## Output dokumentieren
Erstelle `session2_done.md`:
```
- Deep Work Tab: Timer-Logik ✓, Session Save ✓, Today-Liste ✓
- Overview Tab: Alle 4 KPIs ✓, Wochenbalken ✓
- Getestet auf Mobile: [ja/nein]
- Offene Bugs: [Liste]
```
