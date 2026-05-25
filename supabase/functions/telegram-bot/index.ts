import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk'
import { FUTURE_SELF_PROMPT } from './character.ts'

const TELEGRAM_API = `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}`
const ALLOWED_USER_ID = parseInt(Deno.env.get('TELEGRAM_USER_ID') || '0')

// ── TELEGRAM ──
async function sendTelegram(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

// ── SUPABASE CONTEXT ──
async function loadContext(SB: ReturnType<typeof createClient>, userId: string) {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const weekStart = monday.toISOString()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const [dwWeek, trWeek, todosOpen, crmToday, crmWeek, contentWeek] = await Promise.all([
    // DW Stunden diese Woche
    SB.from('tracker_sessions')
      .select('total_seconds, focused_seconds, started_at')
      .eq('type', 'deep_work')
      .eq('is_active', false)
      .eq('created_by', userId)
      .gte('started_at', weekStart),

    // Training diese Woche
    SB.from('tracker_sessions')
      .select('label, started_at')
      .eq('type', 'training')
      .eq('is_active', false)
      .eq('created_by', userId)
      .gte('started_at', weekStart),

    // Offene Todos
    SB.from('tracker_todos')
      .select('title, relevance, due_date, recurring')
      .eq('done', false)
      .eq('created_by', userId)
      .order('relevance', { ascending: false })
      .limit(10),

    // CRM heute
    SB.from('crm_sessions')
      .select('leads_played')
      .eq('created_by', userId)
      .gte('started_at', todayStart),

    // CRM diese Woche
    SB.from('crm_sessions')
      .select('leads_played')
      .eq('created_by', userId)
      .gte('started_at', weekStart),

    // Content diese Woche
    SB.from('tracker_content_log')
      .select('format, title')
      .eq('created_by', userId)
      .gte('published_at', weekStart.split('T')[0]),
  ])

  const dwTotalSec = (dwWeek.data || []).reduce((s: number, r: any) => s + (r.total_seconds || 0), 0)
  const dwFocusSec = (dwWeek.data || []).reduce((s: number, r: any) => s + (r.focused_seconds || 0), 0)
  const dwSessions = dwWeek.data?.length || 0

  const trDays = new Set((trWeek.data || []).map((r: any) => r.started_at?.split('T')[0])).size
  const trSessions = trWeek.data?.length || 0
  const trLabels = [...new Set((trWeek.data || []).map((r: any) => r.label))].join(', ')

  const leadsToday = (crmToday.data || []).reduce((s: number, r: any) => s + (r.leads_played || 0), 0)
  const leadsWeek = (crmWeek.data || []).reduce((s: number, r: any) => s + (r.leads_played || 0), 0)

  const contentCount = contentWeek.data?.length || 0
  const contentFormats = (contentWeek.data || []).map((r: any) => r.format).join(', ')

  const todos = (todosOpen.data || []).map((t: any) =>
    `- [${t.relevance?.toUpperCase()}] ${t.title}${t.due_date ? ` (fällig: ${t.due_date})` : ''}${t.recurring ? ` 🔁` : ''}`
  ).join('\n')

  const isoWeek = getISOWeek(now)

  return `
=== TRACKER-DATEN (KW ${isoWeek}, Stand: jetzt) ===

DEEP WORK diese Woche:
- ${dwSessions} Sessions, ${Math.round(dwTotalSec / 3600 * 10) / 10}h gesamt, ${Math.round(dwFocusSec / 3600 * 10) / 10}h Fokus

TRAINING diese Woche:
- ${trDays} Trainingstage, ${trSessions} Sessions
- Muskelgruppen: ${trLabels || 'keine'}

OUTREACH:
- Heute: ${leadsToday} Leads
- Diese Woche: ${leadsWeek} Leads

CONTENT diese Woche:
- ${contentCount} Stücke${contentCount > 0 ? ` (${contentFormats})` : ''}

OFFENE TODOS (${todosOpen.data?.length || 0}):
${todos || '- Keine offenen Todos'}
`
}

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// ── CLAUDE ──
interface BotReply {
  message: string
  action: { type: string; payload?: Record<string, unknown> } | null
}

async function askClaude(userText: string, context: string): Promise<BotReply> {
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

  const systemPrompt = `${FUTURE_SELF_PROMPT}

${context}

=== ANTWORTFORMAT ===
Antworte IMMER als valides JSON-Objekt:
{
  "message": "Deine Antwort als Future Self (plain text, kein Markdown)",
  "action": null
}

Wenn der User ein Todo erstellen will:
{
  "message": "Kurze Bestätigung im Charakter",
  "action": {
    "type": "todo_create",
    "payload": {
      "title": "Todo-Text",
      "relevance": "high|medium|low",
      "due_date": "YYYY-MM-DD oder null",
      "category": "business|content|privat|gesundheit|andere"
    }
  }
}

Wenn der User Outreach/Leads eintragen will:
{
  "message": "Kurze Bestätigung im Charakter",
  "action": {
    "type": "outreach_log",
    "payload": {
      "leads_played": 42
    }
  }
}

Heute ist: ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userText }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    // JSON aus der Antwort extrahieren (auch wenn Claude Prose davor schreibt)
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as BotReply
  } catch (_) { /* fallthrough */ }

  return { message: raw, action: null }
}

// ── ACTIONS ──
async function executeAction(
  action: BotReply['action'],
  SB: ReturnType<typeof createClient>,
  userId: string
) {
  if (!action) return

  if (action.type === 'todo_create' && action.payload) {
    const p = action.payload as Record<string, unknown>
    await SB.from('tracker_todos').insert({
      title: p.title,
      category: p.category || 'andere',
      relevance: p.relevance || 'medium',
      due_date: p.due_date || null,
      created_by: userId,
    })
  }

  if (action.type === 'outreach_log' && action.payload) {
    const p = action.payload as Record<string, unknown>
    const now = new Date().toISOString()
    await SB.from('crm_sessions').insert({
      started_at: now,
      ended_at: now,
      leads_played: p.leads_played || 0,
      status_breakdown: {},
      duration_seconds: 0,
      created_by: userId,
    })
  }
}

// ── DEDUP CACHE (in-memory, reicht für Edge Function Instanz) ──
const _processed = new Set<number>()

// ── MAIN HANDLER ──
serve(async (req) => {
  let body: any
  try { body = await req.json() } catch { return new Response('ok') }

  const msg = body?.message
  if (!msg?.text) return new Response('ok')

  const messageId: number = msg.message_id
  const chatId: number = msg.chat.id
  const userId: number = msg.from.id
  const text: string = msg.text.trim()

  // Sofort 200 zurück — verhindert Telegram-Retries
  const response = new Response('ok')

  // Doppelverarbeitung derselben message_id verhindern
  if (_processed.has(messageId)) return response
  _processed.add(messageId)
  if (_processed.size > 500) {
    // Set nicht unbegrenzt wachsen lassen
    const first = _processed.values().next().value
    _processed.delete(first)
  }

  // Verarbeitung im Hintergrund (nach Response)
  ;(async () => {
    try {
      if (userId !== ALLOWED_USER_ID) {
        await sendTelegram(chatId, 'Nicht autorisiert.')
        return
      }

      const SB = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SERVICE_ROLE_KEY')!
      )

      const context = await loadContext(SB, userId.toString())
      const reply = await askClaude(text, context)
      await executeAction(reply.action, SB, userId.toString())
      await sendTelegram(chatId, reply.message)
    } catch (err) {
      console.error('Bot error:', err)
    }
  })()

  return response
})
