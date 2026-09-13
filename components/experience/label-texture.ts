import * as THREE from 'three'
import type { GraderScheme } from './chase-cards'

/**
 * Draws a grading-company label plate (name + grade, on that grader's own
 * color scheme) to an offscreen canvas and returns it as a texture -- a
 * canvas is the simplest way to get real, crisp text onto a plane without
 * shipping a separate label image asset per card/grader combination.
 */
export function createLabelTexture(grader: string, scheme: GraderScheme): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = scheme.bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = scheme.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 56px Georgia, serif'
  ctx.fillText(grader, canvas.width / 2, 46)

  ctx.font = '600 30px Arial, sans-serif'
  ctx.fillText(scheme.gradeText, canvas.width / 2, 96)

  ctx.strokeStyle = scheme.accent
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(canvas.width * 0.18, 114)
  ctx.lineTo(canvas.width * 0.82, 114)
  ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
