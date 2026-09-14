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
    return NextResponse.json({ error: 'Could not generate lore right now.' }, { status: 502 })
  }
}
