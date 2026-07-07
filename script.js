/* =========================================================
   WAVEBOARD — script.js
   ---------------------------------------------------------
   This soundboard needs no external audio files: every sound
   is synthesized in-browser with the Web Audio API, rendered
   to a short WAV buffer, and wired up as a normal <audio>
   element. That keeps the whole project self-contained (no
   assets to fetch, nothing to go missing at demo time) while
   still satisfying "real" audio-element behaviour like
   .currentTime, .pause(), and the 'ended' event.
   ========================================================= */

/* ---------------------------------------------------------
   1. TRACK DATA
   One array of objects drives everything: the card grid,
   the sound synthesis, and the click handlers. Add a 13th
   sound by adding one more object here — nothing else
   needs to change.
   --------------------------------------------------------- */
const TRACKS = [
  { id: 'kick',    title: 'Kick Drum',   tag: 'Percussion', glyph: '●',  hue: 262, synth: { type: 'kick' } },
  { id: 'snare',   title: 'Snare Hit',   tag: 'Percussion', glyph: '✦',  hue: 280, synth: { type: 'snare' } },
  { id: 'hihat',   title: 'Hi-Hat',      tag: 'Percussion', glyph: '˙˙˙', hue: 300, synth: { type: 'hihat' } },
  { id: 'clap',    title: 'Clap',        tag: 'Percussion', glyph: '»',  hue: 320, synth: { type: 'clap' } },
  { id: 'bass',    title: 'Bass Pluck',  tag: 'Synth',      glyph: '◗',  hue: 250, synth: { type: 'pluck', freq: 65.4, wave: 'triangle', decay: 0.9 } },
  { id: 'lead',    title: 'Synth Lead',  tag: 'Synth',      glyph: '◆',  hue: 230, synth: { type: 'pluck', freq: 329.6, wave: 'sawtooth', decay: 0.5 } },
  { id: 'chime',   title: 'Chime',       tag: 'Melodic',    glyph: '❋',  hue: 210, synth: { type: 'bell', freq: 880, decay: 1.4 } },
  { id: 'bell',    title: 'Low Bell',    tag: 'Melodic',    glyph: '◎',  hue: 195, synth: { type: 'bell', freq: 220, decay: 1.8 } },
  { id: 'laser',   title: 'Laser FX',    tag: 'FX',         glyph: '↯',  hue: 340, synth: { type: 'sweep', from: 1400, to: 120, decay: 0.35 } },
  { id: 'rise',    title: 'Rise FX',     tag: 'FX',         glyph: '↑',  hue: 355, synth: { type: 'sweep', from: 200, to: 1600, decay: 0.5 } },
  { id: 'horn',    title: 'Airhorn',     tag: 'FX',         glyph: '⟟',  hue: 15,  synth: { type: 'horn', freq: 370, decay: 0.8 } },
  { id: 'scratch', title: 'Vinyl Scratch', tag: 'FX',       glyph: '〜', hue: 275, synth: { type: 'scratch', decay: 0.6 } },
];

/* ---------------------------------------------------------
   2. AUDIO SYNTHESIS
   Each sound is rendered once (offline) into an AudioBuffer,
   then encoded to a WAV Blob URL so it can live in a plain
   <audio> element — that's what gives us free access to
   .currentTime, .pause(), .volume, and the 'ended' event
   without hand-rolling that logic on top of raw Web Audio.
   --------------------------------------------------------- */
const SAMPLE_RATE = 44100;

// Create a short buffer of white noise — used by drum-like sounds.
function whiteNoiseBuffer(ctx, duration) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// Renders one track's synth definition into an AudioBuffer using an
// OfflineAudioContext (runs faster than real-time, no speakers involved).
async function renderTrack(synth) {
  const duration = (synth.decay || 0.5) + 0.15;
  const ctx = new OfflineAudioContext(1, Math.ceil(SAMPLE_RATE * duration), SAMPLE_RATE);
  const now = 0;

  switch (synth.type) {
    case 'kick': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
      gain.gain.setValueAtTime(1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
      break;
    }

    case 'snare': {
      const noise = ctx.createBufferSource();
      noise.buffer = whiteNoiseBuffer(ctx, 0.3);
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1800;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.9, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      const body = ctx.createOscillator();
      body.type = 'triangle';
      body.frequency.value = 180;
      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(0.6, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noise.connect(band).connect(noiseGain).connect(ctx.destination);
      body.connect(bodyGain).connect(ctx.destination);
      noise.start(now);
      body.start(now);
      body.stop(now + 0.12);
      break;
    }

    case 'hihat': {
      const noise = ctx.createBufferSource();
      noise.buffer = whiteNoiseBuffer(ctx, 0.15);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      noise.connect(hp).connect(gain).connect(ctx.destination);
      noise.start(now);
      break;
    }

    case 'clap': {
      // Three staggered noise bursts approximate a hand clap.
      [0, 0.02, 0.045].forEach((offset) => {
        const noise = ctx.createBufferSource();
        noise.buffer = whiteNoiseBuffer(ctx, 0.1);
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 1500;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.8, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
        noise.connect(band).connect(gain).connect(ctx.destination);
        noise.start(now + offset);
      });
      break;
    }

    case 'pluck': {
      const osc = ctx.createOscillator();
      osc.type = synth.wave || 'triangle';
      osc.frequency.value = synth.freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + synth.decay);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + synth.decay);
      break;
    }

    case 'bell': {
      // Fundamental + a slightly detuned overtone for shimmer.
      const fundamental = ctx.createOscillator();
      fundamental.type = 'sine';
      fundamental.frequency.value = synth.freq;
      const overtone = ctx.createOscillator();
      overtone.type = 'sine';
      overtone.frequency.value = synth.freq * 2.01;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + synth.decay);
      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.25, now);
      overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + synth.decay * 0.6);

      fundamental.connect(gain).connect(ctx.destination);
      overtone.connect(overtoneGain).connect(ctx.destination);
      fundamental.start(now);
      overtone.start(now);
      fundamental.stop(now + synth.decay);
      overtone.stop(now + synth.decay);
      break;
    }

    case 'sweep': {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(synth.from, now);
      osc.frequency.exponentialRampToValueAtTime(synth.to, now + synth.decay);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + synth.decay);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + synth.decay);
      break;
    }

    case 'horn': {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = synth.freq;
      // A subtle vibrato via an LFO modulating the oscillator frequency.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 6;
      lfo.connect(lfoGain).connect(osc.frequency);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
      gain.gain.setValueAtTime(0.5, now + synth.decay * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, now + synth.decay);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      lfo.start(now);
      osc.stop(now + synth.decay);
      lfo.stop(now + synth.decay);
      break;
    }

    case 'scratch': {
      const noise = ctx.createBufferSource();
      noise.buffer = whiteNoiseBuffer(ctx, synth.decay);
      noise.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 6;
      band.frequency.value = 1200;
      // LFO wobbles the filter's center frequency to fake a scratch motion.
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 900;
      lfo.connect(lfoGain).connect(band.frequency);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + synth.decay);

      noise.connect(band).connect(gain).connect(ctx.destination);
      noise.start(now);
      lfo.start(now);
      lfo.stop(now + synth.decay);
      break;
    }

    default:
      break;
  }

  return ctx.startRendering();
}

// Encodes a rendered AudioBuffer as a 16-bit PCM WAV file and returns
// an object URL that a normal <audio> element can use as its src.
function bufferToWavURL(audioBuffer) {
  const numChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);
  const dataLength = samples.length * 2; // 16-bit = 2 bytes/sample
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);           // fmt chunk size
  view.setUint16(20, 1, true);            // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true);              // block align
  view.setUint16(34, 16, true);           // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped * 0x7fff, true);
    offset += 2;
  }

  return URL.createObjectURL(new Blob([view], { type: 'audio/wav' }));
}

/* ---------------------------------------------------------
   3. BUILD THE UI
   --------------------------------------------------------- */
const trackGrid = document.getElementById('trackGrid');
const nowPlayingArt = document.getElementById('nowPlayingArt');
const nowPlayingTitle = document.getElementById('nowPlayingTitle');
const nowPlayingSub = document.getElementById('nowPlayingSub');
const playingCount = document.getElementById('playingCount');
const stopAllBtn = document.getElementById('stopAllBtn');
const volumeSlider = document.getElementById('volumeSlider');

// Keeps track of every <audio> element and its card, keyed by track id.
const players = {};
let masterVolume = Number(volumeSlider.value) / 100;

function updatePlayingCount() {
  const active = Object.values(players).filter((p) => !p.audio.paused).length;
  playingCount.textContent = `${active} sound${active === 1 ? '' : 's'} active`;
  nowPlayingArt.classList.toggle('pulse', active > 0);
}

function setCardPlaying(track, isPlaying) {
  players[track.id].card.classList.toggle('is-playing', isPlaying);
}

// Builds one card's DOM from a track definition. Kept in a function
// (rather than 12 hand-written HTML blocks) so the markup and click
// wiring stay in exactly one place.
function createCard(track) {
  const card = document.createElement('button');
  card.className = 'track-card';
  card.setAttribute('type', 'button');
  card.setAttribute('aria-label', `Play ${track.title}`);

  card.innerHTML = `
    <div class="track-art" style="background: linear-gradient(135deg, hsl(${track.hue} 70% 22%), hsl(${track.hue + 25} 65% 12%));">
      <div class="eq-bars"><span></span><span></span><span></span></div>
      <span class="track-art-glyph">${track.glyph}</span>
      <button class="play-btn" type="button" tabindex="-1" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18"><polygon points="6,4 20,12 6,20" fill="currentColor"/></svg>
      </button>
    </div>
    <p class="track-title">${track.title}</p>
    <p class="track-tag">${track.tag}</p>
  `;

  card.addEventListener('click', () => playTrack(track));
  trackGrid.appendChild(card);
  return card;
}

/* ---------------------------------------------------------
   4. PLAYBACK CONTROLS
   --------------------------------------------------------- */

// Plays (or restarts) a single track immediately, regardless of what
// else is currently playing — sounds are allowed to stack.
function playTrack(track) {
  const player = players[track.id];
  if (!player || !player.ready) return;

  const { audio } = player;
  audio.currentTime = 0;
  audio.volume = masterVolume;
  audio.play();

  setCardPlaying(track, true);
  nowPlayingTitle.textContent = track.title;
  nowPlayingSub.textContent = track.tag;
  updatePlayingCount();
}

// The hackathon's required "Stop All" behaviour: pause every sound and
// reset each one's currentTime back to 0, instantly.
function stopAll() {
  Object.values(players).forEach(({ audio, card }) => {
    audio.pause();
    audio.currentTime = 0;
    card.classList.remove('is-playing');
  });
  nowPlayingTitle.textContent = 'Nothing playing';
  nowPlayingSub.textContent = 'Pick a sound to get started';
  updatePlayingCount();
}

stopAllBtn.addEventListener('click', stopAll);

// Custom slider: update the master volume and repaint the fill so the
// coloured portion of the track always matches the current value.
volumeSlider.addEventListener('input', (e) => {
  const value = Number(e.target.value);
  masterVolume = value / 100;
  e.target.style.background =
    `linear-gradient(to right, var(--accent) ${value}%, var(--bg-elevated) ${value}%)`;

  // Live sounds should respond immediately, not just the next one played.
  Object.values(players).forEach(({ audio }) => {
    audio.volume = masterVolume;
  });
});
// Paint the initial fill on load.
volumeSlider.dispatchEvent(new Event('input'));

/* ---------------------------------------------------------
   5. INITIALISATION
   Build every card immediately (so the layout never jumps),
   then synthesize and attach audio in the background.
   --------------------------------------------------------- */
TRACKS.forEach((track) => {
  const card = createCard(track);
  const audio = new Audio();
   audio.loop = true;
  players[track.id] = { audio, card, ready: false };

  // Reflect natural playback end (e.g. a one-shot finishing on its own)
  // back onto the card and the "now playing" summary.
  audio.addEventListener('ended', () => {
    setCardPlaying(track, false);
    updatePlayingCount();
  });

  renderTrack(track.synth)
    .then((buffer) => {
      audio.src = bufferToWavURL(buffer);
      audio.volume = masterVolume;
      players[track.id].ready = true;
    })
    .catch((err) => {
      console.error(`Failed to synthesize "${track.title}":`, err);
    });
});
