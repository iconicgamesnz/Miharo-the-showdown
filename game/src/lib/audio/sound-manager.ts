/**
 * Mīharo: The Showdown — game-show sound system.
 *
 * Uses Web Audio synthesis so the game has original SFX immediately,
 * without licensed/copyrighted music assets.
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

type Listener = (state: {
  unlocked: boolean;
  muted: boolean;
  volume: number;
}) => void;

class SoundManager {
  private unlocked = false;
  private muted = false;
  private volume = 0.75;
  private ctx: AudioContext | null = null;
  private listeners = new Set<Listener>();
  private cache = new Map<string, HTMLAudioElement>();

  get state() {
    return {
      unlocked: this.unlocked,
      muted: this.muted,
      volume: this.volume,
    };
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener(this.state);
  }

  unlock() {
    this.unlocked = true;

    if (typeof window !== "undefined") {
      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (AudioCtx && !this.ctx) {
        this.ctx = new AudioCtx();
      }

      void this.ctx?.resume().catch(() => undefined);
    }

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

  private tone(
    frequency: number,
    duration: number,
    delay = 0,
    type: OscillatorType = "sine",
    gainAmount = 0.16,
  ) {
    if (!this.unlocked || this.muted || !this.ctx) return;

    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const start = ctx.currentTime + delay;
    const end = start + duration;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, gainAmount * this.volume),
      start + 0.015,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(end + 0.03);
  }

  private chord(
    notes: number[],
    duration: number,
    delay = 0,
    type: OscillatorType = "sine",
  ) {
    notes.forEach((note) =>
      this.tone(note, duration, delay, type, 0.11),
    );
  }

  playEvent(event: SoundEvent) {
    if (!this.unlocked || this.muted) return;

    switch (event) {
      case "game_start":
        this.tone(392, 0.14, 0, "square");
        this.tone(523, 0.14, 0.13, "square");
        this.tone(659, 0.28, 0.26, "square");
        break;

      case "round_transition":
        this.tone(220, 0.12, 0, "sawtooth");
        this.tone(330, 0.12, 0.10, "sawtooth");
        this.tone(440, 0.12, 0.20, "sawtooth");
        this.chord([523, 659, 784], 0.35, 0.31, "triangle");
        break;

      case "question_reveal":
        this.tone(523, 0.08, 0, "triangle");
        this.tone(659, 0.12, 0.07, "triangle");
        break;

      case "countdown":
        this.tone(880, 0.07, 0, "square", 0.12);
        break;

      case "answer_lock":
        this.tone(440, 0.05, 0, "square");
        this.tone(660, 0.09, 0.05, "square");
        break;

      case "correct":
        this.tone(523, 0.10, 0, "triangle");
        this.tone(659, 0.10, 0.08, "triangle");
        this.tone(784, 0.22, 0.16, "triangle");
        break;

      case "incorrect":
        this.tone(180, 0.14, 0, "sawtooth");
        this.tone(135, 0.23, 0.10, "sawtooth");
        break;

      case "leaderboard_move":
        this.tone(440, 0.09, 0, "triangle");
        this.tone(554, 0.09, 0.08, "triangle");
        this.tone(659, 0.18, 0.16, "triangle");
        break;

      case "streak":
        this.tone(659, 0.08, 0, "square");
        this.tone(784, 0.08, 0.07, "square");
        this.tone(988, 0.18, 0.14, "square");
        break;

      case "ace_card":
      case "comeback":
        this.tone(330, 0.10, 0, "triangle");
        this.tone(494, 0.10, 0.09, "triangle");
        this.tone(659, 0.24, 0.18, "triangle");
        break;

      case "showdown":
        this.tone(110, 0.35, 0, "sawtooth", 0.13);
        this.tone(220, 0.35, 0.18, "sawtooth", 0.13);
        this.chord([330, 440, 554], 0.55, 0.38, "triangle");
        break;

      case "winner_fanfare":
        this.tone(523, 0.14, 0, "square");
        this.tone(659, 0.14, 0.12, "square");
        this.tone(784, 0.14, 0.24, "square");
        this.tone(1047, 0.50, 0.36, "triangle");
        this.chord([523, 659, 784, 1047], 0.55, 0.48, "triangle");
        break;
    }
  }

  /** Human-recorded Ace clips can still be added later. */
  playAceClip(url: string | null | undefined) {
    if (!url || !this.unlocked || this.muted || typeof Audio === "undefined") {
      return;
    }

    let audio = this.cache.get(url);

    if (!audio) {
      audio = new Audio(url);
      audio.preload = "none";
      this.cache.set(url, audio);
    }

    audio.volume = this.volume;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }
}

export const soundManager = new SoundManager();
