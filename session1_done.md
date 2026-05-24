# SESSION 1 — DONE

## Supabase
- tracker_sessions table: ✓ erstellt
- tracker_content_log table: ✓ erstellt
- Supabase URL: https://qdywaenmojdxhfxqbvun.supabase.co
- Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkeXdhZW5tb2pkeGhmeHFidnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDYwMTYsImV4cCI6MjA5MDk4MjAxNn0.rfIzS2eY3yZCvap0pKdB7V-AfKmnvQLx_QLaFEi1gts

## Auth User — MANUELL NÖTIG
- Email: kevin7ritz@gmail.com
- Passwort: wurde gesetzt (QRelOz3QxLxMHNjA)
- Schritte: Supabase Dashboard → Authentication → Users → "Add User"
  - Email: kevin7ritz@gmail.com
  - Passwort: (oben)
  - "Email Confirm": DEAKTIVIEREN
- User UUID: [nach Anlage hier eintragen — wird von Session 2 benötigt]

## Vercel
- index.html deployed: ✓
- Vercel URL: https://effizienz-tracker-rais.vercel.app
- Custom Domain: tracker.ritz-ai.solutions (DNS noch ausstehend)

## DNS — MANUELL NÖTIG (Cloudflare)
Füge folgenden DNS-Eintrag bei Cloudflare für ritz-ai.solutions hinzu:
- Typ: A
- Name: tracker
- Wert: 76.76.21.21
- Proxy: OFF (DNS only)

Alternativ CNAME:
- Typ: CNAME
- Name: tracker
- Wert: cname.vercel-dns.com

## Shared Utilities (in index.html global definiert)
- formatTime(s) — H:MM:SS Format
- getWeekStart() — Montag dieser Woche als ISO-String

## Für Session 2 + 3
- SB (Supabase client) ist global verfügbar
- showApp() ruft loadOverview() auf falls definiert
- Tab-IDs: tab-overview, tab-deepwork, tab-training, tab-outreach, tab-content
