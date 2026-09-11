import Anthropic from '@anthropic-ai/sdk'
import type { MarketPricingResult } from './types'

let client: Anthropic | null = null

/** Lazy, same reasoning as lib/stripe-server.ts used to (and lib/payments/payfast.ts still does): building this at module scope would throw immediately if ANTHROPIC_API_KEY isn't set, failing Next's build-time page-data collection for a route that hasn't actually run yet. */
function getAnthropicClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

const MODEL = 'claude-sonnet-5'

export interface SpecialistReport {
  language: 'english' | 'japanese'
  summary: string
}

export interface TrendRecommendation {
  cardName: string
  setName: string
  language: 'english' | 'japanese'
  rawEstimate: number
  gradedEstimate: number
  profitMultiplier: number
  actionableAdvice: string
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

async function runSpecialist(role: 'English' | 'Japanese', data: MarketPricingResult): Promise<SpecialistReport> {
  const message = await getAnthropicClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are the ${role} Specialist on a card-market analysis team for a Pokémon/sports-card grading and resale business. Analyze the raw vs. graded price data you're given and summarize notable spreads, movements, and any ${
      role === 'Japanese' ? 'promo/exclusive-set trends' : 'set-level trends'
    }. Only comment on cards and prices actually present in the data below — never invent a card, set, or price that wasn't given to you. Be concise and factual.`,
    messages: [
      {
        role: 'user',
        content: `Current ${role} market data (JSON):\n${JSON.stringify(data.points, null, 2)}\n\n${
          data.isPlaceholder
            ? 'NOTE: this data is empty placeholder/test data, not real market data. Say so explicitly rather than analyzing it as if it were real, and do not name any specific cards.'
            : ''
        }`,
      },
    ],
  })

  return { language: role === 'English' ? 'english' : 'japanese', summary: extractText(message) }
}

export function runEnglishSpecialist(data: MarketPricingResult): Promise<SpecialistReport> {
  return runSpecialist('English', data)
}

export function runJapaneseSpecialist(data: MarketPricingResult): Promise<SpecialistReport> {
  return runSpecialist('Japanese', data)
}

function isValidRecommendation(value: unknown): value is TrendRecommendation {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.cardName === 'string' &&
    r.cardName.length > 0 &&
    typeof r.setName === 'string' &&
    (r.language === 'english' || r.language === 'japanese') &&
    typeof r.rawEstimate === 'number' &&
    Number.isFinite(r.rawEstimate) &&
    r.rawEstimate >= 0 &&
    typeof r.gradedEstimate === 'number' &&
    Number.isFinite(r.gradedEstimate) &&
    r.gradedEstimate >= 0 &&
    typeof r.profitMultiplier === 'number' &&
    Number.isFinite(r.profitMultiplier) &&
    typeof r.actionableAdvice === 'string' &&
    r.actionableAdvice.length > 0
  )
}

/**
 * Consolidates both specialists' reports into up to 5 "buy raw & grade"
 * recommendations. Deliberately conservative about trusting the model's
 * JSON: parse failures or malformed entries are dropped (isValidRecommendation),
 * not coerced -- a recommendation with a missing/garbled field is worse
 * than one recommendation short, since app/api/cron/market-trends/route.ts
 * persists whatever comes back here as if it were a real number.
 */
export async function runTrendAnalyst(
  englishReport: SpecialistReport,
  japaneseReport: SpecialistReport,
): Promise<TrendRecommendation[]> {
  const message = await getAnthropicClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: `You are the Trend Analyst consolidating two specialists' reports into arbitrage recommendations for a card grading/resale business. profitMultiplier is gradedEstimate / rawEstimate. Respond with ONLY a JSON array (no prose, no markdown code fences) of up to 5 objects, each with exactly these fields: cardName (string), setName (string), language ("english" or "japanese"), rawEstimate (number), gradedEstimate (number), profitMultiplier (number), actionableAdvice (a one-sentence string). Only include a card if one of the reports below actually named it with real prices — never invent a card, set, or price. If neither report contains real (non-placeholder) pricing data, respond with exactly: []`,
    messages: [
      {
        role: 'user',
        content: `English Specialist report:\n${englishReport.summary}\n\nJapanese Specialist report:\n${japaneseReport.summary}`,
      },
    ],
  })

  const text = extractText(message)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    console.error('runTrendAnalyst: Analyst output was not valid JSON', err, text)
    return []
  }

  if (!Array.isArray(parsed)) return []
  return parsed.filter(isValidRecommendation).slice(0, 5)
}
