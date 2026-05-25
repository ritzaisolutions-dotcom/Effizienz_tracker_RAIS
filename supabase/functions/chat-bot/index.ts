import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk'
import { FUTURE_SELF_PROMPT } from '../telegram-bot/character.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

// ── BOT SETTINGS ──
async function loadBotSettings(SB: ReturnType<typeof createClient>, userId: string) {
  const { data } = await SB
    .from('bot_settings')
    .select('character_prompt, selected_model')
    .eq('user_id', userId)
    .maybeSingle()
  return {
    characterPrompt: data?.character_prompt || FUTURE_SELF_PROMPT,
    selectedModel: data?.selected_model || 'claude-sonnet-4-6',
  }
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
    SB.from('tracker_sessions')
      .select('total_seconds, focused_seconds, started_at')
      .eq('type', 'deep_work').eq('is_active', false).eq('created_by', userId)
      .gte('started_at', weekStart),
    SB.from('tracker_sessions')
      .select('label, started_at')
      .eq('type', 'training').eq('is_active', false).eq('created_by', userId)
      .gte('started_at', weekStart),
    SB.from('tracker_todos')
      .select('title, relevance, due_date, recurring')
      .eq('done', false).eq('created_by', userId)
      .order('relevance', { ascending: false }).limit(10),
    SB.from('crm_sessions').select('leads_played').eq('created_by', userId).gte('started_at', todayStart),
    SB.from('crm_sessions').select('leads_played').eq('created_by', userId).gte('started_at', weekStart),
    SB.from('tracker_content_log').select('format, title').eq('created_by', userId)
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

  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const isoWeek = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)

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

// ── EXECUTE ACTION ──
async function executeAction(
  action: { type: string; payload?: Record<string, unknown> } | null,
  SB: ReturnType<typeof createClient>,
  userId: string
) {
  if (!action) return
  if (action.type === 'todo_create' && action.payload) {
    const p = action.payload
    await SB.from('tracker_todos').insert({
      title: p.title, category: p.category || 'andere',
      relevance: p.relevance || 'medium', due_date: p.due_date || null,
      created_by: userId,
    })
  }
  if (action.type === 'outreach_log' && action.payload) {
    const p = action.payload
    const now = new Date().toISOString()
    await SB.from('crm_sessions').insert({
      started_at: now, ended_at: now, leads_played: p.leads_played || 0,
      status_breakdown: {}, duration_seconds: 0, created_by: userId,
    })
  }
}

// ── MAIN ──
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const SB = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await SB.auth.getUser()
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const body = await req.json()
    const userMessage: string = body.message || ''
    const requestedModel: string | undefined = body.model
    const file: { name: string; type: string; data: string } | undefined = body.file

    const [context, botSettings] = await Promise.all([
      loadContext(SB, user.id),
      loadBotSettings(SB, user.id),
    ])

    const model = requestedModel || botSettings.selectedModel

    const systemPrompt = `${botSettings.characterPrompt}

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
  "action": { "type": "todo_create", "payload": { "title": "...", "relevance": "high|medium|low", "due_date": "YYYY-MM-DD oder null", "category": "business|content|privat|gesundheit|andere" } }
}

Wenn der User Outreach/Leads eintragen will:
{
  "message": "Kurze Bestätigung im Charakter",
  "action": { "type": "outreach_log", "payload": { "leads_played": 42 } }
}

Heute ist: ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
`

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    // Build message content — text + optional file
    type ContentBlock =
      | { type: 'text'; text: string }
      | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
      | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } }

    const content: ContentBlock[] = []
    if (userMessage) content.push({ type: 'text', text: userMessage })
    if (file) {
      if (file.type.startsWith('image/')) {
        content.push({ type: 'image', source: { type: 'base64', media_type: file.type as any, data: file.data } })
      } else if (file.type === 'application/pdf') {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.data } })
      }
    }
    if (content.length === 0) content.push({ type: 'text', text: '...' })

    const response = await client.messages.create({
      model,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    let reply = raw
    let action = null

    try {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        reply = parsed.message || raw
        action = parsed.action || null
      }
    } catch (_) { /* fallthrough */ }

    await executeAction(action, SB, user.id)

    return new Response(JSON.stringify({ reply, action }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('chat-bot error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
