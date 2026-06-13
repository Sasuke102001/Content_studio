import { createClient } from 'npm:@supabase/supabase-js@2'

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 3

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type ProxyPayload = {
  model: string
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
}

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
  const secretKey = secretKeys['default'] ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !secretKey) {
    throw new Error('Supabase admin environment is not configured in the Edge Function runtime.')
  }

  return createClient(supabaseUrl, secretKey)
}

async function authenticateRequest(req: Request) {
  const authorization = req.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')

  if (!token) {
    return { token: '', userId: '', error: 'Missing bearer token.' }
  }

  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.auth.getUser(token)

  if (error || !data.user) {
    return { token, userId: '', error: error?.message ?? 'Supabase user lookup failed.' }
  }

  return { token, userId: data.user.id, error: '' }
}

async function enforceRateLimit(userId: string) {
  const admin = getSupabaseAdminClient()
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { count, error } = await admin
    .from('ai_request_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)

  if (error) {
    throw new Error(`Rate limit lookup failed: ${error.message}`)
  }

  if ((count ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
    return false
  }

  return true
}

async function logUsage(userId: string, model: string) {
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('ai_request_log').insert({
    user_id: userId,
    action: 'chat_completion',
    model,
  })

  if (error) {
    throw new Error(`Usage logging failed: ${error.message}`)
  }
}

function getVendorApiKey(model: string) {
  if (model.startsWith('sarvamai/')) {
    return Deno.env.get('SARVAM_API_KEY') ?? ''
  }

  return Deno.env.get('NVIDIA_API_KEY') ?? ''
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405 })
  }

  try {
    const { userId, error } = await authenticateRequest(req)
    if (error || !userId) {
      return Response.json({ error: error || 'Unauthorized.' }, { status: 401 })
    }

    const allowed = await enforceRateLimit(userId)
    if (!allowed) {
      return Response.json(
        { error: 'Rate limit exceeded. This app allows 3 upstream AI requests per minute per session.' },
        { status: 429 },
      )
    }

    const payload = (await req.json()) as ProxyPayload
    if (!payload?.model || !Array.isArray(payload.messages) || payload.messages.length === 0) {
      return Response.json({ error: 'Invalid proxy payload.' }, { status: 400 })
    }

    const vendorKey = getVendorApiKey(payload.model)
    if (!vendorKey) {
      return Response.json(
        { error: `Provider secret missing for model ${payload.model}.` },
        { status: 500 },
      )
    }

    await logUsage(userId, payload.model)

    const upstreamResponse = await fetch(NVIDIA_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vendorKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: payload.model,
        messages: payload.messages,
        temperature: payload.temperature ?? 0.6,
        max_tokens: payload.max_tokens ?? 8000,
        stream: false,
      }),
    })

    const upstreamText = await upstreamResponse.text()
    if (!upstreamResponse.ok) {
      return new Response(upstreamText, {
        status: upstreamResponse.status,
        headers: { 'Content-Type': upstreamResponse.headers.get('Content-Type') ?? 'text/plain' },
      })
    }

    const upstreamJson = JSON.parse(upstreamText)
    const content = upstreamJson?.choices?.[0]?.message?.content ?? ''

    return Response.json({
      content,
      model: payload.model,
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown Edge Function error.' },
      { status: 500 },
    )
  }
})
