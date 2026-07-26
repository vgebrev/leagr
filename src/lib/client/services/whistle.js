/**
 * Referee's whistle, synthesised with the Web Audio API.
 *
 * Synthesised rather than shipped as an audio file: it avoids a binary in the
 * repo and any licensing question, and it has no download latency — the app has
 * no service worker, so a static asset would be fetched cold on first play.
 *
 * Two variants, distinguished by length. Short means play continues (kick-off,
 * restart after a stoppage, or "regulation is over, last play is live"); long
 * means the game is done. Duration carries better across a noisy pitch than a
 * change of pitch or timbre would.
 */

/** @type {AudioContext | null} */
let context = null;

/**
 * Lazily create the shared AudioContext.
 * @returns {AudioContext | null} The context, or null where Web Audio is unavailable
 */
function getContext() {
    if (typeof window === 'undefined') return null;

    if (!context) {
        const Ctor = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
        if (!Ctor) return null;
        try {
            context = new Ctor();
        } catch (error) {
            console.error('Error creating AudioContext:', error);
            return null;
        }
    }

    return context;
}

/**
 * Resume the AudioContext from within a user gesture.
 *
 * Load-bearing: the full-time whistle fires from a timer callback with no
 * gesture behind it and would be blocked by autoplay policy. Unlocking once at
 * kick-off covers every later signal in the session.
 */
export function unlockAudio() {
    const ctx = getContext();
    if (!ctx) return;

    try {
        if (ctx.state === 'suspended') {
            ctx.resume().catch((error) => console.error('Error resuming AudioContext:', error));
        }
    } catch (error) {
        console.error('Error unlocking audio:', error);
    }
}

/**
 * Short burst of filtered noise, giving the whistle its breathy attack.
 * @param {AudioContext} ctx
 * @param {AudioNode} destination
 * @param {number} startAt
 */
function addBreath(ctx, destination, startAt) {
    const duration = 0.06;
    const buffer = ctx.createBuffer(
        1,
        Math.max(1, Math.floor(ctx.sampleRate * duration)),
        ctx.sampleRate
    );
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
        // Fades across the burst so it reads as an attack rather than a click.
        samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2400;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.value = 0.08;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(startAt);
    source.stop(startAt + duration);
}

/**
 * Play a referee's whistle.
 * @param {{ long?: boolean }} [options] - long: full-time whistle rather than a short one
 */
export function playWhistle({ long = false } = {}) {
    const ctx = getContext();
    if (!ctx) return;

    try {
        unlockAudio();

        const now = ctx.currentTime;
        const duration = long ? 1.2 : 0.35;

        // Bandpass keeps the tone thin and whistle-like rather than buzzy.
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2500;
        filter.Q.value = 4;

        const master = ctx.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.linearRampToValueAtTime(0.35, now + 0.005); // 5ms attack
        master.gain.setValueAtTime(0.35, now + duration * 0.6);
        master.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        filter.connect(master);
        master.connect(ctx.destination);

        // The "pea": an LFO wobbling both oscillators.
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 18;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 120;
        lfo.connect(lfoGain);

        // Two detuned oscillators - the beating between them is what makes this
        // read as a whistle instead of a beep.
        for (const frequency of [2400, 2560]) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, now);
            if (long) {
                // Full time drops away at the end, like a whistle running out of breath.
                osc.frequency.exponentialRampToValueAtTime(frequency * 0.82, now + duration);
            }
            lfoGain.connect(osc.frequency);
            osc.connect(filter);
            osc.start(now);
            osc.stop(now + duration);
        }

        lfo.start(now);
        lfo.stop(now + duration);

        addBreath(ctx, filter, now);
    } catch (error) {
        console.error('Error playing whistle:', error);
    }
}

/**
 * Vibrate the device, where supported.
 *
 * iOS Safari does not implement the Vibration API at all, so this is a silent
 * no-op there. Android Chrome supports it once the page has been interacted with.
 * @param {number[]} pattern - Vibration pattern in milliseconds
 */
export function vibrate(pattern) {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

    try {
        navigator.vibrate(pattern);
    } catch (error) {
        console.error('Error triggering vibration:', error);
    }
}
