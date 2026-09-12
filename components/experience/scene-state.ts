/** Plain mutable state GSAP's scroll-scrubbed timeline writes to every frame, read by the R3F render loop. Kept out of React state so scrolling never triggers a re-render. */
export interface SceneState {
  /** 0-1 progress through the pinned scroll journey. */
  scroll: number
  /** 0-1: how far the shards have flown apart. */
  explode: number
  /** Extra core spin added on top of its idle rotation as the journey progresses. */
  rotationBoost: number
}

export function createSceneState(): SceneState {
  return { scroll: 0, explode: 0, rotationBoost: 0 }
}
