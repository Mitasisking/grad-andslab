import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAdmin } from '@/lib/require-admin'

let client: Anthropic | null = null

/** Lazy, same reasoning as lib/market-trends/agents.ts -- building this at module scope would throw immediately if ANTHROPIC_API_KEY isn't set, failing Next's build-time page-data collection for a route that hasn't actually run yet. */
function getAnthropicClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

const MODEL = 'claude-sonnet-5'

interface GenerateLoreBody {
  cardTitle?: string
  cardSet?: string
}

/**
 * Backs the "✨ Generate Lore" button in the Shop Admin product form
 * (product-form-modal.tsx). Admin-only since it spends API credits and the
 * output is always reviewed/edited by the admin before saving -- this route
 * never writes to the database itself, it just returns text.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = (await request.json()) as GenerateLoreBody
  const cardTitle = body.cardTitle?.trim()
  const cardSet = body.cardSet?.trim()

  if (!cardTitle) {
    return NextResponse.json({ error: 'cardTitle is required' }, { status: 400 })
  }

  // Checked explicitly (not just left to fail inside the try/catch below)
  // so a missing key reports as exactly that instead of collapsing into the
  // same generic "Could not generate lore right now." every other failure
  // (a real Anthropic outage, a bad response) also produces -- same
  // reasoning as app/api/admin/psa/verify-cert/route.ts's PSA_API_TOKEN check.
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('generate-lore: ANTHROPIC_API_KEY is not configured')
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 500 })
  }

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 512,
      system:
        'You are an expert Pokémon TCG historian writing premium collector-facing lore for a card grading and resale business. Write a captivating, ~100-word story about the specified card, focusing on its artwork, the Pokémon\'s vibe/personality, and why collectors chase it. Write in a warm, museum-plaque tone. Return ONLY the lore text -- no heading, no title, no quotation marks, no markdown.',
      messages: [
        {
          role: 'user',
          content: `Card: ${cardTitle}${cardSet ? `\nSet: ${cardSet}` : ''}`,
        },
      ],
    })

    const lore = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim()

    if (!lore) {
      return NextResponse.json({ error: 'The model returned no text.' }, { status: 502 })
    }

    return NextResponse.json({ lore })
  } catch (err) {
    console.error('generate-lore: Anthropic request failed', err)
    // Surface the SDK's own message (e.g. "invalid x-api-key", "overloaded_error")
    // rather than just a generic string -- same reasoning as PSA verify-cert's
    // `detail` field: a specific cause beats a guess when this shows up in the
    // admin UI.
    const detail = err instanceof Error ? err.message : undefined
    return NextResponse.json({ error: 'Could not generate lore right now.', detail }, { status: 502 })
  }
}
