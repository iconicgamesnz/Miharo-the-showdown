/**
 * Modular sound system.
 *
 * Nothing plays until the display is unlocked by a user gesture (browser
 * autoplay policy). Sound files are supplied later; missing files are a no-op
 * rather than an error, so the game runs silently until assets land.
 */

export const SOUND_EVENTS = [
  "game_start",
  "question_reveal",
  "countdown",
  "answer_lock",
  "correct",
  "incorrect",
  "leaderboard_move",
  "streak",
  "ace_card",
  "comeback",
  "round_transition",
  "showdown",
  "winner_fanfare",
] as const;
export type SoundEvent = (typeof SOUND_EVENTS)[number];

/** PLACEHOLDER: populate as approved audio files are added to /public/audio. */
const SOUND_SOURCES: Partial<Record<SoundEvent, string>> = {};

type Listener = (state: { unlocked: boolean; muted: boolean; volume: number }) => void;

class SoundManager {
  private unlocked = false;
  private muted = false;
  private volume = 0.8;
  private cache = new Map<string, HTMLAudioElement>();
  private listeners = new Set<Listener>();

  get state() {
    return { unlocked: this.unlocked, muted: this.muted, volume: this.volume };
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l(this.state);
  }

  /** Call from a click/tap handler. */
  unlock() {
    this.unlocked = true;
    this.emit();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.emit();
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    this.emit();
  }

  private play(src: string) {
    if (!this.unlocked || this.muted || typeof Audio === "undefined") return;
    let el = this.cache.get(src);
    if (!el) {
      el = new Audio(src);
      el.preload = "none";
      this.cache.set(src, el);
    }
    el.volume = this.volume;
    el.currentTime = 0;
    void el.play().catch(() => undefined);
  }

  playEvent(event: SoundEvent) {
    const src = SOUND_SOURCES[event];
    if (src) this.play(src);
  }

  /** Ace voice clips come from the database (uploaded human recordings). */
  playAceClip(url: string | null | undefined) {
    if (url) this.play(url);
  }
}

export const soundManager = new SoundManager();
