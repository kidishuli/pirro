/**
 * Plays a pleasant, crystal-clear digital payment confirmation chime
 * using the Web Audio API (zero external assets, instant zero-latency playback).
 */
export function playPaymentChime() {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Helper to play a harmonic bell tone with exponential decay
    const playTone = (freq: number, startTime: number, duration: number, gainValue = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Smooth attack and natural bell-like exponential decay
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Note 1 (E5 - 659.25 Hz): Quick bright upbeat
    playTone(659.25, now, 0.18, 0.14);

    // Note 2 (B5 - 987.77 Hz & E6 - 1318.51 Hz): Resonant harmonic chime
    playTone(987.77, now + 0.09, 0.50, 0.16);
    playTone(1318.51, now + 0.09, 0.70, 0.20);
    playTone(2637.02, now + 0.09, 0.35, 0.04); // subtle sparkle overtone
  } catch (err) {
    console.warn('Could not play payment chime:', err);
  }
}
