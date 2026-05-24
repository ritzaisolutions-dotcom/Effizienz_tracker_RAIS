# RAIS TRACKER — SESSION KOORDINATION
**Alle vier Files liegen in diesem Ordner. Jedes ist ein eigener Claude Code Terminal.**

---

## Reihenfolge & Abhängigkeiten

```
SESSION 1 (Foundation)     ─── muss ZUERST starten
    │
    ├── SESSION 2 (Deep Work + Overview)   ─── startet wenn Session 1 Tabellen angelegt hat
    │
    ├── SESSION 3 (Training + Outreach)    ─── startet wenn Session 1 fertig + Session 2 formatTime() definiert hat
    │
    └── SESSION 4 (Content + Deploy)       ─── startet wenn Sessions 1-3 fertig sind
```

**Praktisch:** Session 1 zuerst fertig machen (~30 Min), dann Session 2+3 simultan, dann Session 4.

---

## Was jede Session macht

| Session | File | Tabs | Abhängigkeit |
|---|---|---|---|
| 1 | SESSION_1_FOUNDATION.md | Login + App Shell + DB Schema | keine |
| 2 | SESSION_2_DEEPWORK_OVERVIEW.md | Deep Work + Overview | Session 1 |
| 3 | SESSION_3_TRAINING_OUTREACH.md | Training + Outreach | Session 1 + 2 (formatTime) |
| 4 | SESSION_4_CONTENT_POLISH_DEPLOY.md | Content + PWA + Deploy | Sessions 1-3 |

---

## Kritische Infos die alle Sessions brauchen

- **Supabase Project ID:** `qdywaenmojdxhfxqbvun`
- **Supabase URL:** `https://qdywaenmojdxhfxqbvun.supabase.co`
- **Anon Key:** → Im Supabase Dashboard unter Settings → API → `anon` `public`
- **Target Domain:** `tracker.ritz-ai.solutions`
- **Ampel-Mapping:**
  - 🟢 Win: `demo`, `closing`
  - 🟡 Warm: `door_open`
  - 🟡 Neutral / nochmal anrufen: `followup`, `gatekeeper`, `nicht_erreicht`, `kein_anschluss`
  - 🔴 Tot (einziges Rot): `disqualified`
- **Muskelgruppen:** Brust · Rücken · Schultern · Arme · Beine · Core · Cardio · Full Body
- **Content Typen:** episode · short · post
- **Content Plattformen:** eckstein · youtube · instagram · tiktok

---

## Shared Utility Functions (einmal definieren in Session 1, alle nutzen)

```javascript
// formatTime — wird von Sessions 2, 3, 4 genutzt
function formatTime(s) {
  const h = Math.floor(s / 3600).toString().padStart(2, '0');
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

// getWeekStart — Montag dieser Woche als ISO-Date-String
function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(new Date().setDate(diff));
  return monday.toISOString().split('T')[0];
}
```

Diese beiden Funktionen **global** in `index.html` definieren — nicht in jedem Tab separat.

---

## Definition of Done (Gesamt)

Das Projekt ist fertig wenn alle vier `session_done.md` Files erstellt wurden und der Smoke Test in Session 4 komplett grün ist.
