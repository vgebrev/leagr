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
 *
 * Loudness comes from saturation rather than raw gain. The voices are summed
 * well past unity and pushed through a `tanh` soft-clipper, which is bounded —
 * so peaks cannot clip however hard it is driven — while the flattened waveform
 * raises average level far above what a bare sine reaches at the same peak. The
 * harmonics that clipping generates are the point too: a pure sine is polite,
 * and a whistle on a pitch needs to be anything but.
 */

/**
 * Tuning knobs, all in one place — this is a thing judged by ear, so expect to
 * turn these rather than restructure the graph below.
 */
const WHISTLE = {
    /** The pair that beats against each other; the beat is what says "whistle". */
    frequencies: [2350, 2510],
    /** Level per fundamental, before saturation. */
    voiceLevel: 0.5,
    /**
     * An octave up, for bite. Kept deliberately low: the saturation below
     * already generates harmonics, so this only tops them up. Measured, at the
     * same loudness to within 0.1 dB — 0.22 made the octave the *strongest*
     * partial, which moves the perceived pitch up and reads as a smoke alarm;
     * 0 is darker and purer. 0.1 keeps the fundamental dominant.
     */
    harmonicRatio: 2,
    harmonicLevel: 0.1,
    /** The rattling "pea": LFO rate in Hz and its swing in Hz either side. */
    trillHz: 20,
    trillDepth: 150,
    /** Air noise: a chiff on the attack settling to a hiss under the tone. */
    breathLevel: 0.12,
    breathAttackLevel: 0.4,
    /** Soft-clip drive. Higher is louder and harsher; peaks stay bounded. */
    drive: 3.2,
    /** Final peak level. The clipper guarantees nothing exceeds this. */
    outputLevel: 0.92,
    /** Seconds. Long is a full-time blast, short is everything else. */
    shortDuration: 1.0,
    longDuration: 1.5
};

/** @type {AudioContext | null} */
let context = null;

/** @type {Float32Array | null} */
let clipCurve = null;

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
 * Transfer curve for the soft-clipper: a normalised `tanh`, so an input of any
 * size maps into ±1 and the output can never clip the device.
 * @returns {Float32Array}
 */
function getClipCurve() {
    if (clipCurve) return clipCurve;

    const samples = 1024;
    const curve = new Float32Array(samples);
    const norm = Math.tanh(WHISTLE.drive);
    for (let i = 0; i < samples; i++) {
        const x = (i / (samples - 1)) * 2 - 1;
        curve[i] = Math.tanh(WHISTLE.drive * x) / norm;
    }

    clipCurve = curve;
    return curve;
}

/**
 * Air noise running the length of the whistle, loudest on the attack.
 * @param {AudioContext} ctx
 * @param {AudioNode} destination
 * @param {number} startAt
 * @param {number} duration
 */
function addAir(ctx, destination, startAt, duration) {
    const buffer = ctx.createBuffer(
        1,
        Math.max(1, Math.floor(ctx.sampleRate * duration)),
        ctx.sampleRate
    );
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2600;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(WHISTLE.breathAttackLevel, startAt);
    gain.gain.exponentialRampToValueAtTime(WHISTLE.breathLevel, startAt + 0.08);

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
        const duration = long ? WHISTLE.longDuration : WHISTLE.shortDuration;

        // Output stage first, so everything below has somewhere to land.
        // Envelope sits *after* the clipper: the clipper then sees a steady
        // level and saturates evenly, instead of only biting on the attack.
        const envelope = ctx.createGain();
        envelope.gain.setValueAtTime(0.0001, now);
        envelope.gain.linearRampToValueAtTime(WHISTLE.outputLevel, now + 0.008);
        envelope.gain.setValueAtTime(WHISTLE.outputLevel, now + duration * 0.85);
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        envelope.connect(ctx.destination);

        const shaper = ctx.createWaveShaper();
        shaper.curve = getClipCurve();
        shaper.connect(envelope);

        // Wide enough to pass the harmonics that make it cut; narrow enough to
        // keep the low rumble of the noise out.
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2450;
        filter.Q.value = 1.5;
        filter.connect(shaper);

        // The "pea": an LFO wobbling every voice together.
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = WHISTLE.trillHz;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = WHISTLE.trillDepth;
        lfo.connect(lfoGain);

        /**
         * @param {number} frequency
         * @param {number} level
         */
        const addVoice = (frequency, level) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, now);
            if (long) {
                // Full time sags at the very end, like a whistle running out of
                // breath. Held flat until then, so it stays a blast not a siren.
                osc.frequency.setValueAtTime(frequency, now + duration * 0.7);
                osc.frequency.exponentialRampToValueAtTime(frequency * 0.85, now + duration);
            }

            const gain = ctx.createGain();
            gain.gain.value = level;

            lfoGain.connect(osc.frequency);
            osc.connect(gain);
            gain.connect(filter);
            osc.start(now);
            osc.stop(now + duration);
        };

        for (const frequency of WHISTLE.frequencies) {
            addVoice(frequency, WHISTLE.voiceLevel);
            addVoice(frequency * WHISTLE.harmonicRatio, WHISTLE.harmonicLevel);
        }

        lfo.start(now);
        lfo.stop(now + duration);

        addAir(ctx, filter, now, duration);
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
