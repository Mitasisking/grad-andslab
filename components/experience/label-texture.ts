import * as THREE from 'three'
import type { Grader } from '@/lib/shop/grader'
import type { GraderScheme } from './chase-cards'

/**
 * Deterministic pseudo-barcode -- a row of variable-width bars mimicking a
 * cert-lookup barcode without encoding a real number (there's no real cert
 * behind this hero, see the doc comment below), so it must never look
 * scannable/genuine, just textural.
 */
function drawBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, color: string) {
  ctx.fillStyle = color
  let cursor = x
  let s = seed || 1
  while (cursor < x + w) {
    s = (s * 9301 + 49297) % 233280
    const barW = 1 + (s / 233280) * 3
    if (Math.floor(s / 8) % 2 === 0) ctx.fillRect(cursor, y, barW, h)
    cursor += barW + 2
  }
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Draws a grading-company label plate to an offscreen canvas and returns it
 * as a texture -- a canvas is the simplest way to get real, crisp text and
 * layout onto a plane without shipping a separate label image asset per
 * card/grader combination. The two layouts below are styled to *read* as
 * PCG's gold/gem-mint plates and ACE's navy/cyan plates from across the
 * hero's fan, matching the accent colors chase-cards.ts already assigns each
 * grader -- deliberately not a pixel copy of either company's real
 * trademarked slab design, same "illustrative, not a specific real cert"
 * stance this file always took, now just carried further into layout too.
 */
export function createLabelTexture(grader: Grader, scheme: GraderScheme): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height

  if (grader === 'PCG') {
    // Gold foil sheen: a soft diagonal gradient plus one brighter streak.
    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, '#f6d98a')
    bg.addColorStop(0.5, scheme.bg)
    bg.addColorStop(1, '#c9a53d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.globalAlpha = 0.22
    ctx.fillStyle = '#fffaf0'
    ctx.beginPath()
    ctx.moveTo(w * 0.08, 0)
    ctx.lineTo(w * 0.28, 0)
    ctx.lineTo(w * 0.14, h)
    ctx.lineTo(w * -0.06, h)
    ctx.fill()
    ctx.restore()
  } else {
    // Deep navy with a faint technical grid -- reads as "certified/scanned".
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#1c2c4d')
    bg.addColorStop(1, scheme.bg)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(90,209,230,0.12)'
    ctx.lineWidth = 1
    for (let gx = 0; gx < w; gx += 32) {
      ctx.beginPath()
      ctx.moveTo(gx, 0)
      ctx.lineTo(gx, h)
      ctx.stroke()
    }
  }

  ctx.strokeStyle = scheme.accent
  ctx.lineWidth = 6
  roundedRectPath(ctx, 4, 4, w - 8, h - 8, 14)
  ctx.stroke()

  // Grade badge, left -- the number a collector's eye actually looks for.
  const badgeR = h * 0.34
  const badgeX = badgeR + 30
  const badgeY = h / 2
  ctx.beginPath()
  ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2)
  ctx.fillStyle = grader === 'PCG' ? '#241b06' : '#eaf6ff'
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = scheme.accent
  ctx.stroke()
  ctx.fillStyle = grader === 'PCG' ? scheme.bg : scheme.accent
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${Math.round(badgeR * 1.15)}px Georgia, serif`
  ctx.fillText('10', badgeX, badgeY + h * 0.02)

  // Wordmark + subtitle + grade text, center.
  const textX = badgeX + badgeR + 44
  ctx.textAlign = 'left'
  ctx.fillStyle = scheme.fg
  ctx.font = '800 84px Georgia, serif'
  ctx.fillText(grader, textX, h * 0.36)

  ctx.font = '600 26px Arial, sans-serif'
  ctx.fillText(grader === 'PCG' ? 'PREMIER CARD GRADING' : 'AUTHENTIC CARD EXAM', textX, h * 0.52)

  ctx.font = '700 38px Arial, sans-serif'
  ctx.fillStyle = scheme.accent
  ctx.fillText(scheme.gradeText, textX, h * 0.74)

  ctx.strokeStyle = scheme.accent
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(textX, h * 0.6)
  ctx.lineTo(w - 40, h * 0.6)
  ctx.stroke()

  // Pseudo-barcode, bottom-right -- textural cert-lookup flourish, not a real code.
  drawBarcode(ctx, textX, h * 0.84, w - textX - 40, h * 0.08, grader === 'PCG' ? 17 : 41, scheme.fg)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
