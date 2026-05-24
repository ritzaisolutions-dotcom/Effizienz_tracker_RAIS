# SESSION 3 — DONE

## Training Tab
- Timer-Logik (tr-Prefix, unabhängig von Deep Work): ✓
- Muskelgruppen-Picker (8 Gruppen, Pflichtfeld): ✓
- Start-Button disabled bis Muskelgruppe gewählt: ✓
- Pause/Resume (Aktiv-Zeit stoppt, Gesamt läuft): ✓
- Summary Modal mit Muskelgruppe + Zeiten: ✓
- Supabase: trCreateSession / trSaveSession / trDiscardSession: ✓
- Today-Liste mit Aktiv-Zeit pro Session: ✓
- Tab-Click-Listener: initMusclePicker + loadTRToday: ✓

## Outreach Tab (Read-Only)
- Ampel-Mapping (demo/closing=grün, door_open=hellgrün, followup/gatekeeper/nicht_erreicht/kein_anschluss=gelb, disqualified=rot): ✓
- Periode Today / Woche / Monat (Tabs): ✓
- Summary: Sessions, Gespielt, Conv%: ✓
- Breakdown: Win / Warm / Neutral / Dead: ✓
- Session-Liste mit Status-Badges: ✓
- Tab-Click-Listener: loadOutreach('today'): ✓

## Technische Hinweise
- Tab-Listener via initTabListeners() die beim Boot aufgerufen werden (DOM muss existieren)
- crm_sessions und crm_session_events: nur SELECT, kein INSERT/UPDATE/DELETE
- demo und closing korrekt als tier='win' (grün) behandelt

## Für Session 4
- tab-content DIV bereit
- SB, formatTime, getWeekStart, loadOverview global verfügbar
