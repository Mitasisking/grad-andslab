/**
 * Procedurally synthesized SFX for the card-shatter-fan (Web Audio API, no
 * audio files) -- a shatter "crack" and a bright glint "chime". Synthesizing
 * both avoids needing to source/license actual sound recordings for two
 * short, stylized effects.
 *
 * Browsers block audio until a real user gesture; a raw scroll doesn't
 * reliably count, so the shared AudioContext is created lazily and resumed
 * on the page's first pointerdown/keydown/touchstart/wheel, whichever comes
 * first -- by the time a visitor has scrolled far enough to trigger the
 * shatter, one of those has almost always already fired.
 */

let audioCtx: AudioContext | null = null

// Muted by default -- a raw scroll or the page's own passive gesture-unlock
// below only satisfies the *browser's* autoplay gate (letting the
// AudioContext resume at all); it says nothing about whether this visitor
// actually wants sound. Actual playback additionally requires the explicit
// opt-in below (AudioToggle), so a first-time visitor never hears anything
// until they deliberately turn it on.
let muted = true

export function isAudioMuted(): boolean {
  return muted
}

/** Called from AudioToggle's onClick -- a real user gesture, so this is also the reliable place to resume a still-suspended AudioContext. */
export function setAudioMuted(next: boolean) {
  muted = next
  if (!muted) getContext()?.resume().catch(() => {})
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    audioCtx = new Ctor()
  }
  return audioCtx
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    const ctx = getContext()
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
    events.forEach((event) => window.removeEventListener(event, unlock))
  }
  const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'wheel']
  events.forEach((event) => window.addEventListener(event, unlock, { once: true, passive: true }))
}

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function playClick(ctx: AudioContext, time: number, freq: number, peak: number) {
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, time)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.4, time + 0.04)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)

  osc.connect(gain).connect(ctx.destination)
  osc.start(time)
  osc.stop(time + 0.06)
}

/** A short burst of filtered noise plus a few sharp high "chip" clicks -- reads as cracking plastic/glass, not a uniform thud. */
export function playShatterSound(intensity = 1) {
  if (muted) return
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime

  const noise = ctx.createBufferSource()
  noise.buffer = createNoiseBuffer(ctx, 0.35)

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(1800, now)
  bandpass.frequency.exponentialRampToValueAtTime(600, now + 0.3)
  bandpass.Q.value = 0.8

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.5 * intensity, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34)

  noise.connect(bandpass).connect(gain).connect(ctx.destination)
  noise.start(now)
  noise.stop(now + 0.36)

  for (let i = 0; i < 4; i++) {
    const delay = i * 0.015 + Math.random() * 0.01
    playClick(ctx, now + delay, 1800 + Math.random() * 1200, 0.15 * intensity)
  }
}

/** A bright, brief chime -- three detuned sine partials with a quick pitch lift, timed to the slab's glint sweep. `detuneSemitones` spreads the three cards' chimes into a chord instead of an identical stacked copy. */
export function playGlintSound(detuneSemitones = 0) {
  if (muted) return
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  const detune = Math.pow(2, detuneSemitones / 12)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
  gain.connect(ctx.destination)

  ;[1046.5, 1568, 2093].forEach((freq, i) => {
    const target = freq * detune
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(target * 0.98, now)
    osc.frequency.exponentialRampToValueAtTime(target, now + 0.08)

    const voiceGain = ctx.createGain()
    voiceGain.gain.value = i === 0 ? 1 : 0.4

    osc.connect(voiceGain).connect(gain)
    osc.start(now + i * 0.02)
    osc.stop(now + 0.9)
  })
}
