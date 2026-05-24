## ARBEITSREGEL — KONSERVATIV, STOP BEI FRAGEN

1. Bei jeder Unklarheit: SOFORT STOPPEN. Keine Annahmen treffen.
2. Eine Frage auf einmal stellen, dann auf Antwort warten.
3. Nichts loeschen oder ueberschreiben was eine andere Session gebaut hat, ohne Bestaetigung.
4. Nur umsetzen was in diesem File steht. Keine eigenen Ideen hinzufuegen.
5. Wenn Supabase Key fehlt, Tabelle nicht existiert, oder Code-Konflikt entsteht: SOFORT STOPP und melden.

---
# SESSION 3 — Training Tab + Outreach Tab
**Voraussetzung: Session 1 muss Tabellen angelegt haben. Session 2 muss Timer-Logik (formatTime, Supabase SB) fertig haben.**
**Arbeitet auf der `index.html` von Session 1/2.**

---

## Kontext

Du ergänzt `index.html` um:
- `#tab-training` — identische Timer-Logik wie Deep Work, aber mit Muskelgruppen-Pflichtfeld
- `#tab-outreach` — Read-Only Darstellung der Call-Sessions aus dem CRM

Supabase: `qdywaenmojdxhfxqbvun`
Tabellen:
- `tracker_sessions` — Training schreiben
- `crm_sessions` — Read-Only (kein INSERT, kein UPDATE)
- `crm_session_events` — Read-Only

Design-System: identisch zu Session 2 (CSS-Variablen bereits definiert)

---

## Aufgabe 1 — Training Tab

Identische Timer-Logik wie Deep Work, mit zwei Unterschieden:
1. **Muskelgruppe ist Pflichtfeld** — wird vor dem Start ausgewählt
2. **Label** = ausgewählte Muskelgruppe (kein Freitext)

### Muskelgruppen
```javascript
const MUSCLE_GROUPS = [
  'Brust', 'Rücken', 'Schultern', 'Arme', 'Beine', 'Core', 'Cardio', 'Full Body'
];
```

### Timer State (separat von Deep Work — eigene Variablen mit Prefix `tr`)

```javascript
let trState = 'idle';
let trTotalSeconds = 0;
let trActiveSeconds = 0;
let trTotalInterval = null;
let trActiveInterval = null;
let trStartedAt = null;
let trCurrentSessionId = null;
let trSelectedMuscle = null;

function trStart() {
  if (!trSelectedMuscle) return; // Guard — Muskelgruppe muss gewählt sein
  trState = 'active';
  trStartedAt = new Date();
  trTotalSeconds = 0;
  trActiveSeconds = 0;

  trTotalInterval = setInterval(() => { trTotalSeconds++; renderTRTimers(); }, 1000);
  trActiveInterval = setInterval(() => { trActiveSeconds++; }, 1000);

  trCreateSession();
  renderTRState();
  document.getElementById('tr-muscle-picker').classList.add('hidden');
}

function trPause() {
  if (trState !== 'active') return;
  trState = 'paused';
  clearInterval(trActiveInterval);
  renderTRState();
}

function trResume() {
  if (trState !== 'paused') return;
  trState = 'active';
  trActiveInterval = setInterval(() => { trActiveSeconds++; }, 1000);
  renderTRState();
}

function trEnd() {
  clearInterval(trTotalInterval);
  clearInterval(trActiveInterval);
  trState = 'idle';
  showTRSummaryModal();
}

function renderTRTimers() {
  document.getElementById('tr-total').textContent = formatTime(trTotalSeconds);
  document.getElementById('tr-active').textContent = formatTime(trActiveSeconds);
  document.getElementById('tr-pause').textContent = formatTime(trTotalSeconds - trActiveSeconds);
}

function renderTRState() {
  const idle = document.getElementById('tr-idle');
  const running = document.getElementById('tr-running');
  const pauseBtn = document.getElementById('tr-pause-btn');
  const statusEl = document.getElementById('tr-status-indicator');

  if (trState === 'idle') {
    idle.classList.remove('hidden');
    running.classList.add('hidden');
    trSelectedMuscle = null;
    document.getElementById('tr-muscle-picker').classList.remove('hidden');
  } else {
    idle.classList.add('hidden');
    running.classList.remove('hidden');
  }

  if (trState === 'paused') {
    pauseBtn.textContent = '▶ WEITER';
    statusEl.style.color = 'var(--yellow)';
    statusEl.textContent = '⏸ PAUSE / QUATSCHEN';
  } else if (trState === 'active') {
    pauseBtn.textContent = '⏸ PAUSE';
    statusEl.style.color = 'var(--green)';
    statusEl.textContent = '● TRAINING AKTIV';
  }
}
```

### Supabase für Training

```javascript
async function trCreateSession() {
  const { data: { user } } = await SB.auth.getUser();
  const { data } = await SB.from('tracker_sessions').insert({
    type: 'training',
    label: trSelectedMuscle,
    started_at: trStartedAt.toISOString(),
    is_active: true,
    is_paused: false,
    created_by: user.id
  }).select('id').single();
  trCurrentSessionId = data.id;
}

async function trSaveSession() {
  if (!trCurrentSessionId) return;
  await SB.from('tracker_sessions').update({
    ended_at: new Date().toISOString(),
    total_seconds: trTotalSeconds,
    focused_seconds: trActiveSeconds,
    is_active: false,
    is_paused: false
  }).eq('id', trCurrentSessionId);
  trCurrentSessionId = null;
  loadTRToday();
  loadOverview();
}

async function trDiscardSession() {
  if (!trCurrentSessionId) return;
  await SB.from('tracker_sessions').delete().eq('id', trCurrentSessionId);
  trCurrentSessionId = null;
}
```

### HTML für Training Tab

```html
<div id="tr-idle" class="tr-state">
  <div class="section-title">Training Session</div>

  <!-- Muskelgruppen-Picker -->
  <div id="tr-muscle-picker" class="card">
    <div style="font-size:0.75rem; color:var(--muted); margin-bottom:1rem; letter-spacing:0.1em;">
      MUSKELGRUPPE WÄHLEN
    </div>
    <div id="tr-muscle-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:1rem;">
      <!-- Wird per JS generiert -->
    </div>
    <button class="btn-primary" onclick="trStart()" id="tr-start-btn" disabled
      style="opacity:0.4; cursor:not-allowed;">
      ▶ TRAINING STARTEN
    </button>
  </div>

  <div class="section-title" style="margin-top:1.5rem;">HEUTE</div>
  <div id="tr-today-list"></div>
</div>

<div id="tr-running" class="tr-state hidden">
  <div class="card">
    <div style="font-size:0.75rem; color:var(--muted); margin-bottom:0.5rem; letter-spacing:0.1em;" id="tr-muscle-display"></div>

    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; text-align:center; margin-bottom:1.5rem;">
      <div>
        <div style="font-size:0.6rem; letter-spacing:0.15em; color:var(--muted); margin-bottom:0.4rem;">GESAMT</div>
        <div id="tr-total" style="font-family:var(--font-mono); font-size:1.4rem; color:var(--text);">00:00:00</div>
      </div>
      <div>
        <div style="font-size:0.6rem; letter-spacing:0.15em; color:var(--green); margin-bottom:0.4rem;">AKTIV</div>
        <div id="tr-active" style="font-family:var(--font-mono); font-size:1.4rem; color:var(--green);">00:00:00</div>
      </div>
      <div>
        <div style="font-size:0.6rem; letter-spacing:0.15em; color:var(--muted); margin-bottom:0.4rem;">PAUSE</div>
        <div id="tr-pause" style="font-family:var(--font-mono); font-size:1.4rem; color:var(--muted);">00:00:00</div>
      </div>
    </div>

    <div id="tr-status-indicator" style="text-align:center; font-size:0.75rem; letter-spacing:0.15em; color:var(--green); margin-bottom:1.5rem;">
      ● TRAINING AKTIV
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
      <button id="tr-pause-btn" onclick="trTogglePause()"
        style="background:var(--surface); border:1px solid var(--border); border-radius:8px;
               padding:1rem; color:var(--text); font-family:var(--font-ui); font-size:0.9rem; cursor:pointer;">
        ⏸ PAUSE
      </button>
      <button onclick="trEnd()"
        style="background:transparent; border:1px solid var(--red); border-radius:8px;
               padding:1rem; color:var(--red); font-family:var(--font-ui); font-size:0.9rem; cursor:pointer;">
        ⏹ FERTIG
      </button>
    </div>
  </div>
</div>

<!-- Training Summary Modal -->
<div id="tr-summary-modal" class="hidden"
  style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:300;
         display:flex; align-items:flex-end; justify-content:center;">
  <div style="background:var(--surface); border-radius:16px 16px 0 0; padding:2rem;
              width:100%; max-width:480px; border-top:1px solid var(--border);">
    <div style="font-size:0.7rem; letter-spacing:0.2em; color:var(--muted); margin-bottom:1.5rem;">
      TRAINING ZUSAMMENFASSUNG
    </div>
    <div id="tr-summary-content" style="margin-bottom:1.5rem;"></div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
      <button onclick="trDiscard()"
        style="background:transparent; border:1px solid var(--border); border-radius:8px;
               padding:1rem; color:var(--muted); font-family:var(--font-ui); cursor:pointer;">
        Verwerfen
      </button>
      <button onclick="trSave()"
        style="background:var(--green); border:none; border-radius:8px;
               padding:1rem; color:#000; font-family:var(--font-ui); font-weight:600; cursor:pointer;">
        Speichern
      </button>
    </div>
  </div>
</div>
```

### Muskel-Picker JS

```javascript
function initMusclePicker() {
  const grid = document.getElementById('tr-muscle-grid');
  grid.innerHTML = MUSCLE_GROUPS.map(m => `
    <button onclick="selectMuscle('${m}')" id="muscle-${m}"
      style="padding:0.75rem 0.5rem; background:var(--bg); border:1px solid var(--border);
             border-radius:8px; color:var(--muted); font-family:var(--font-ui);
             font-size:0.85rem; cursor:pointer; transition:all 0.15s;">
      ${m}
    </button>
  `).join('');
}

function selectMuscle(m) {
  trSelectedMuscle = m;
  document.querySelectorAll('[id^="muscle-"]').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.color = 'var(--muted)';
    b.style.background = 'var(--bg)';
  });
  const btn = document.getElementById('muscle-' + m);
  btn.style.borderColor = 'var(--green)';
  btn.style.color = 'var(--green)';
  btn.style.background = 'rgba(34,197,94,0.08)';

  const startBtn = document.getElementById('tr-start-btn');
  startBtn.disabled = false;
  startBtn.style.opacity = '1';
  startBtn.style.cursor = 'pointer';
}

function trTogglePause() {
  if (trState === 'active') trPause();
  else if (trState === 'paused') trResume();
}

function showTRSummaryModal() {
  const pct = trTotalSeconds > 0 ? Math.round((trActiveSeconds / trTotalSeconds) * 100) : 0;
  document.getElementById('tr-summary-content').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--muted)">Muskelgruppe</span>
        <span style="color:var(--green); font-weight:500;">${trSelectedMuscle}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--muted)">Gesamt</span>
        <span style="font-family:var(--font-mono)">${formatTime(trTotalSeconds)}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--green)">Aktiv</span>
        <span style="font-family:var(--font-mono); color:var(--green)">${formatTime(trActiveSeconds)} (${pct}%)</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--muted)">Pause / Talk</span>
        <span style="font-family:var(--font-mono); color:var(--muted)">${formatTime(trTotalSeconds - trActiveSeconds)} (${100-pct}%)</span>
      </div>
    </div>
  `;
  document.getElementById('tr-summary-modal').classList.remove('hidden');
}

async function trSave() {
  document.getElementById('tr-summary-modal').classList.add('hidden');
  await trSaveSession();
  trTotalSeconds = 0; trActiveSeconds = 0;
  renderTRTimers();
  renderTRState();
  initMusclePicker();
}

async function trDiscard() {
  document.getElementById('tr-summary-modal').classList.add('hidden');
  await trDiscardSession();
  trTotalSeconds = 0; trActiveSeconds = 0;
  renderTRTimers();
  renderTRState();
  initMusclePicker();
}

async function loadTRToday() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await SB.from('tracker_sessions')
    .select('*')
    .eq('type', 'training')
    .eq('is_active', false)
    .gte('started_at', today + 'T00:00:00+00:00')
    .order('started_at', { ascending: false });

  const list = document.getElementById('tr-today-list');
  if (!data || data.length === 0) {
    list.innerHTML = '<div style="color:var(--muted); font-size:0.85rem;">Noch kein Training heute.</div>';
    return;
  }

  list.innerHTML = data.map(r => `
    <div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:0.85rem 1rem;">
      <div>
        <div style="font-size:0.85rem; color:var(--green); font-weight:500;">${r.label}</div>
        <div style="font-size:0.7rem; color:var(--muted);">${new Date(r.started_at).toLocaleTimeString('de-DE', {hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:var(--font-mono); font-size:0.9rem; color:var(--green);">${formatTime(r.focused_seconds || 0)}</div>
        <div style="font-size:0.65rem; color:var(--muted);">aktiv</div>
      </div>
    </div>
  `).join('');
}

// Init beim Tab-Wechsel
document.querySelector('[data-tab="training"]').addEventListener('click', () => {
  if (trState === 'idle') initMusclePicker();
  loadTRToday();
});
```

---

## Aufgabe 2 — Outreach Tab (Read-Only)

### Ampel-Mapping

```javascript
const STATUS_AMPEL = {
  // 🟢 Grün — echter Win
  'demo':           { color: 'var(--green)',  label: 'Demo',           tier: 'win' },
  'closing':        { color: 'var(--green)',  label: 'Closing',        tier: 'win' },
  // 🟡 Warm — positives Gespräch, kein Abschluss
  'door_open':      { color: '#86EFAC',       label: 'Door Open',      tier: 'warm' },
  // 🟡 Gelb — Neutral / nochmal anrufen
  'followup':       { color: 'var(--yellow)', label: 'Follow-up',      tier: 'neutral' },
  'gatekeeper':     { color: 'var(--yellow)', label: 'Gatekeeper',     tier: 'neutral' },
  'nicht_erreicht': { color: 'var(--yellow)', label: 'Nicht erreicht', tier: 'neutral' },
  'kein_anschluss': { color: 'var(--yellow)', label: 'Kein Anschluss', tier: 'neutral' },
  // 🔴 Rot — einziges echtes Rot: Lead ist tot
  'disqualified':   { color: 'var(--red)',    label: 'Disqualified',   tier: 'dead' },
  // ⚪ Grau
  'neu':            { color: 'var(--muted)',  label: 'Neu',            tier: 'untouched' },
};

function getStatusColor(s) { return STATUS_AMPEL[s]?.color || 'var(--muted)'; }
function getStatusTier(s)  { return STATUS_AMPEL[s]?.tier  || 'neutral'; }
```

### Daten laden

```javascript
async function loadOutreach(period = 'today') {
  let fromDate;
  const now = new Date();

  if (period === 'today') {
    fromDate = now.toISOString().split('T')[0] + 'T00:00:00+00:00';
  } else if (period === 'week') {
    fromDate = getWeekStart() + 'T00:00:00+00:00';
  } else if (period === 'month') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] + 'T00:00:00+00:00';
  }

  const { data: sessions } = await SB
    .from('crm_sessions')
    .select('id, started_at, ended_at, leads_played, status_breakdown, duration_seconds')
    .gte('started_at', fromDate)
    .order('started_at', { ascending: false });

  // Alle Events für die gefundenen Sessions laden
  const sessionIds = (sessions || []).map(s => s.id);
  let events = [];
  if (sessionIds.length > 0) {
    const { data: ev } = await SB
      .from('crm_session_events')
      .select('session_id, status_to, changed_at')
      .in('session_id', sessionIds);
    events = ev || [];
  }

  renderOutreach(sessions || [], events, period);
}

function renderOutreach(sessions, events, period) {
  // Aggregieren
  const totalPlayed = sessions.reduce((s, r) => s + (r.leads_played || 0), 0);
  const totalDuration = sessions.reduce((s, r) => s + (r.duration_seconds || 0), 0);

  // Status-Breakdown aus Events
  const breakdown = {};
  events.forEach(e => {
    breakdown[e.status_to] = (breakdown[e.status_to] || 0) + 1;
  });

  // Tier-Zählung
  let wins = 0, warm = 0, neutral = 0, dead = 0;
  Object.entries(breakdown).forEach(([status, count]) => {
    const tier = getStatusTier(status);
    if (tier === 'win') wins += count;
    else if (tier === 'warm') warm += count;
    else if (tier === 'neutral') neutral += count;
    else if (tier === 'dead') dead += count;
  });

  const convRate = totalPlayed > 0 ? ((wins / totalPlayed) * 100).toFixed(1) : '0.0';

  // Period Tabs
  const tabs = ['today', 'week', 'month'];
  const tabLabels = { today: 'Heute', week: 'Woche', month: 'Monat' };

  document.getElementById('tab-outreach').innerHTML = `
    <!-- Period Selector -->
    <div style="display:flex; gap:0.5rem; margin-bottom:1.25rem;">
      ${tabs.map(t => `
        <button onclick="loadOutreach('${t}')"
          style="flex:1; padding:0.6rem; border-radius:8px; font-family:var(--font-ui);
                 font-size:0.8rem; cursor:pointer; border:1px solid ${t === period ? 'var(--accent)' : 'var(--border)'};
                 background:${t === period ? 'rgba(200,255,0,0.08)' : 'transparent'};
                 color:${t === period ? 'var(--accent)' : 'var(--muted)'};">
          ${tabLabels[t]}
        </button>
      `).join('')}
    </div>

    <!-- Summary Card -->
    <div class="card" style="margin-bottom:0.75rem;">
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; text-align:center; margin-bottom:1rem;">
        <div>
          <div style="font-size:0.6rem; color:var(--muted); letter-spacing:0.1em; margin-bottom:0.25rem;">SESSIONS</div>
          <div style="font-family:var(--font-mono); font-size:1.5rem;">${sessions.length}</div>
        </div>
        <div>
          <div style="font-size:0.6rem; color:var(--muted); letter-spacing:0.1em; margin-bottom:0.25rem;">GESPIELT</div>
          <div style="font-family:var(--font-mono); font-size:1.5rem;">${totalPlayed}</div>
        </div>
        <div>
          <div style="font-size:0.6rem; color:var(--muted); letter-spacing:0.1em; margin-bottom:0.25rem;">CONV %</div>
          <div style="font-family:var(--font-mono); font-size:1.5rem; color:${wins > 0 ? 'var(--green)' : 'var(--muted)'};">${convRate}%</div>
        </div>
      </div>

      <!-- Ampel Breakdown -->
      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        ${ampelRow('🟢 Win (Demo / Closing)', wins, totalPlayed, 'var(--green)')}
        ${ampelRow('🟡 Warm (Door Open)', warm, totalPlayed, '#86EFAC')}
        ${ampelRow('🟡 Neutral', neutral, totalPlayed, 'var(--yellow)')}
        ${ampelRow('🔴 Kein Anschluss / DQ', dead, totalPlayed, 'var(--red)')}
      </div>
    </div>

    <!-- Session Liste -->
    <div class="section-title">SESSIONS</div>
    ${sessions.length === 0
      ? '<div style="color:var(--muted); font-size:0.85rem;">Keine Sessions in diesem Zeitraum.</div>'
      : sessions.map(s => {
          const sb = s.status_breakdown || {};
          return `
            <div class="card" style="padding:0.85rem 1rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                <div style="font-size:0.85rem;">${new Date(s.started_at).toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit'})}</div>
                <div style="font-size:0.85rem; font-family:var(--font-mono);">${s.leads_played} Leads</div>
              </div>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                ${Object.entries(sb).map(([status, count]) => `
                  <span style="font-size:0.7rem; padding:0.2rem 0.5rem; border-radius:4px;
                               background:rgba(255,255,255,0.05); color:${getStatusColor(status)};">
                    ${count}× ${STATUS_AMPEL[status]?.label || status}
                  </span>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')
    }
  `;
}

function ampelRow(label, count, total, color) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return `
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <div style="flex:1; font-size:0.75rem; color:var(--muted);">${label}</div>
      <div style="font-family:var(--font-mono); font-size:0.85rem; color:${color}; min-width:2rem; text-align:right;">${count}</div>
      <div style="font-size:0.7rem; color:var(--muted); min-width:2.5rem; text-align:right;">${pct}%</div>
    </div>
  `;
}

// Tab-Wechsel Trigger
document.querySelector('[data-tab="outreach"]').addEventListener('click', () => {
  loadOutreach('today');
});
```

---

## Output dokumentieren
Erstelle `session3_done.md`:
```
- Training Tab: Timer ✓, Muskel-Picker ✓, Session Save ✓
- Outreach Tab: Ampel-Mapping ✓, Today/Woche/Monat ✓, Session-Liste ✓
- demo/closing als Grün-Status korrekt behandelt: [ja/nein]
- Getestet: [ja/nein]
- Bugs: [Liste]
```
