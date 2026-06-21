/**
 * Áudio 100% procedural (Web Audio API) — mesma filosofia dos modelos: nada de
 * arquivos externos para licenciar/baixar. Sintetiza efeitos sonoros (latido,
 * miado, coleta, susto, vitória…) e duas trilhas em loop (menu calmo e gameplay
 * animado) usando osciladores + envelopes + ruído.
 *
 * Uso: `Audio.sfx("bark")`, `Audio.music("gameplay")`, `Audio.toggleMute()`.
 * Singleton exportado como `Audio`. O AudioContext só "destrava" após o
 * primeiro gesto do usuário (exigência dos navegadores) — ver unlock().
 */

export type SfxName =
  | "uiMove"
  | "uiConfirm"
  | "uiBack"
  | "bark"
  | "meow"
  | "whoosh"
  | "pickup"
  | "deliver"
  | "broke"
  | "stun"
  | "step"
  | "win"
  | "lose";

export type MusicTrack = "menu" | "gameplay";

/** Ambiência por fase (drone contínuo + eventos aleatórios). */
export type AmbientName =
  | "house"
  | "birds"
  | "living"
  | "kitchen"
  | "yard"
  | "street"
  | "chaos"
  | "calm";

/** Mapa fase (1..8) → ambiência. */
const AMBIENCE_BY_PHASE: AmbientName[] = [
  "house", // 1 carteiro
  "birds", // 2 pássaros
  "living", // 3 almofadas
  "kitchen", // 4 cozinha
  "yard", // 5 vizinho
  "street", // 6 moto
  "chaos", // 7 caos total
  "calm", // 8 perdão
];

interface Note {
  /** início (s) dentro do loop */
  t: number;
  /** frequência (Hz) */
  f: number;
  /** duração (s) */
  d: number;
  /** ganho relativo (0..1) */
  g?: number;
  type?: OscillatorType;
}

interface TrackDef {
  /** comprimento do loop (s) */
  loop: number;
  notes: Note[];
}

const STORAGE_KEY = "caos_audio_v1";

/** Volumes padrão (0..1). master multiplica música e efeitos. */
const DEFAULTS = { master: 0.9, music: 0.35, sfx: 0.8 };

interface AudioSettings {
  muted: boolean;
  master: number;
  music: number;
  sfx: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** midi → Hz (A4=69=440). */
function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

/** Constrói uma trilha simples a partir de uma sequência de graus. */
function buildTracks(): Record<MusicTrack, TrackDef> {
  // Menu: arpejo pentatônico calmo (Cmaj), 4s de loop.
  const menuNotes: Note[] = [];
  const menuSteps = [60, 64, 67, 72, 67, 64]; // C E G C G E
  menuSteps.forEach((m, i) => {
    menuNotes.push({ t: i * (4 / menuSteps.length), f: midi(m), d: 0.7, g: 0.5, type: "triangle" });
  });
  // baixo suave
  menuNotes.push({ t: 0, f: midi(36), d: 2, g: 0.4, type: "sine" });
  menuNotes.push({ t: 2, f: midi(43), d: 2, g: 0.4, type: "sine" });

  // Gameplay: groove animado, 2s de loop, baixo marcante + melodia saltitante.
  const gpNotes: Note[] = [];
  const bass = [40, 40, 47, 45]; // E E B A
  bass.forEach((m, i) => {
    gpNotes.push({ t: i * 0.5, f: midi(m), d: 0.45, g: 0.55, type: "sawtooth" });
  });
  const lead = [64, 67, 71, 67, 69, 67, 64, 62]; // melodia
  lead.forEach((m, i) => {
    gpNotes.push({ t: i * 0.25, f: midi(m), d: 0.18, g: 0.32, type: "square" });
  });

  return {
    menu: { loop: 4, notes: menuNotes },
    gameplay: { loop: 2, notes: gpNotes },
  };
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // ambiência
  private currentAmbient: AmbientName | null = null;
  private ambientNodes: Array<{ stop: () => void }> = [];
  private ambientTimer: number | null = null;
  private ambienceEvent: (() => void) | null = null;
  private ambienceEvery: [number, number] = [3, 7];

  private muted = false;
  private masterVolume = DEFAULTS.master;
  private musicVolume = DEFAULTS.music;
  private sfxVolume = DEFAULTS.sfx;
  private unlocked = false;

  private tracks = buildTracks();
  private currentTrack: MusicTrack | null = null;
  private schedulerId: number | null = null;
  private nextLoopStart = 0;

  constructor() {
    const s = this.loadSettings();
    this.muted = s.muted;
    this.masterVolume = s.master;
    this.musicVolume = s.music;
    this.sfxVolume = s.sfx;
  }

  private loadSettings(): AudioSettings {
    const def: AudioSettings = { muted: false, ...DEFAULTS };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return def;
      const p = JSON.parse(raw) as Partial<AudioSettings>;
      return {
        muted: !!p.muted,
        master: clamp01(Number(p.master ?? DEFAULTS.master)),
        music: clamp01(Number(p.music ?? DEFAULTS.music)),
        sfx: clamp01(Number(p.sfx ?? DEFAULTS.sfx)),
      };
    } catch {
      return def;
    }
  }

  private saveSettings(): void {
    try {
      const s: AudioSettings = {
        muted: this.muted,
        master: this.masterVolume,
        music: this.musicVolume,
        sfx: this.sfxVolume,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* localStorage indisponível — segue só em memória */
    }
  }

  /** Registra listeners para destravar o áudio no 1º gesto do usuário. */
  unlock(): void {
    if (this.unlocked) return;
    const resume = () => {
      this.ensure();
      this.ctx?.resume();
      // re-arma a trilha pendente, se houver
      if (this.currentTrack && this.schedulerId === null) {
        this.startScheduler();
      }
    };
    window.addEventListener("pointerdown", resume, { once: false });
    window.addEventListener("keydown", resume, { once: false });
    this.unlocked = true;
  }

  /** Cria o grafo de áudio sob demanda. */
  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVolume;
    this.master.connect(ctx.destination);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.master);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);

    // ambiência: bus próprio em nível modesto (afetado por master + mudo)
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.3;
    this.ambientGain.connect(this.master);

    // buffer de ruído branco reutilizável (whoosh / susto / quebra)
    const len = ctx.sampleRate * 1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    this.ctx = ctx;
    return ctx;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyMaster();
    this.saveSettings();
  }

  /** Aplica master*muted ao nó de saída (suave). */
  private applyMaster(): void {
    if (this.master && this.ctx) {
      const target = this.muted ? 0 : this.masterVolume;
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    }
  }

  get volumes(): { master: number; music: number; sfx: number } {
    return { master: this.masterVolume, music: this.musicVolume, sfx: this.sfxVolume };
  }

  setMasterVolume(v: number): void {
    this.masterVolume = clamp01(v);
    this.applyMaster();
    this.saveSettings();
  }

  setMusicVolume(v: number): void {
    this.musicVolume = clamp01(v);
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.03);
    }
    this.saveSettings();
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = clamp01(v);
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.03);
    }
    this.saveSettings();
  }

  /** Abaixa a música por `seconds` e volta ao normal (ducking sob fanfarras). */
  private duckMusic(seconds: number): void {
    if (!this.musicGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const full = Math.max(0.0001, this.musicVolume);
    const low = Math.max(0.0001, this.musicVolume * 0.25);
    const g = this.musicGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(full, now);
    g.linearRampToValueAtTime(low, now + 0.08);
    g.linearRampToValueAtTime(full, now + seconds);
  }

  // ─── Ambiência ─────────────────────────────────────────────────────────────
  /** Define a ambiência da fase (1..8). */
  ambientForPhase(phase: number): void {
    this.ambient(AMBIENCE_BY_PHASE[phase - 1] ?? "house");
  }

  /** Troca a ambiência em loop (no-op se já for a atual; null = silêncio). */
  ambient(name: AmbientName | null): void {
    if (this.currentAmbient === name) return;
    this.currentAmbient = name;
    this.stopAmbient();
    if (!name) return;
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
    this.buildAmbience(name);
    if (this.ambienceEvent) this.scheduleAmbientEvent();
  }

  private stopAmbient(): void {
    if (this.ambientTimer !== null) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
    for (const n of this.ambientNodes) n.stop();
    this.ambientNodes = [];
    this.ambienceEvent = null;
  }

  /** Oscilador contínuo (drone) roteado pelo bus de ambiência. */
  private addDrone(freq: number, type: OscillatorType, gain: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(this.ambientGain!);
    osc.start();
    this.ambientNodes.push({
      stop: () => {
        try {
          osc.stop();
        } catch {
          /* já parado */
        }
        osc.disconnect();
        g.disconnect();
      },
    });
  }

  /** Ruído filtrado contínuo (brisa / tráfego). */
  private addNoiseDrone(filterHz: number, gain: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterHz;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.ambientGain!);
    src.start();
    this.ambientNodes.push({
      stop: () => {
        try {
          src.stop();
        } catch {
          /* já parado */
        }
        src.disconnect();
        filter.disconnect();
        g.disconnect();
      },
    });
  }

  private scheduleAmbientEvent(): void {
    const [lo, hi] = this.ambienceEvery;
    const delay = (lo + Math.random() * (hi - lo)) * 1000;
    this.ambientTimer = window.setTimeout(() => {
      this.ambienceEvent?.();
      this.scheduleAmbientEvent();
    }, delay);
  }

  /** Monta drones + evento aleatório de cada ambiência. */
  private buildAmbience(name: AmbientName): void {
    const amb = this.ambientGain!;
    const now = () => this.ctx!.currentTime;
    switch (name) {
      case "house":
        this.addDrone(70, "sine", 0.05); // tom de casa
        break;
      case "birds":
        this.addNoiseDrone(900, 0.015);
        this.ambienceEvery = [1.4, 3.8];
        this.ambienceEvent = () => {
          const t = now();
          this.blip(2300 + Math.random() * 700, 0.06, "sine", 0.18, t, 400, amb);
          this.blip(2700, 0.05, "sine", 0.13, t + 0.07, -300, amb);
        };
        break;
      case "living":
        this.addDrone(60, "sine", 0.05);
        this.ambienceEvery = [5, 10];
        this.ambienceEvent = () => this.noise(0.8, 0.1, 480, now(), 280, amb); // brisa
        break;
      case "kitchen":
        this.addDrone(80, "sine", 0.04); // zumbido de geladeira
        this.ambienceEvery = [2.2, 5];
        this.ambienceEvent = () =>
          this.blip(1700 + Math.random() * 900, 0.09, "triangle", 0.13, now(), -200, amb); // talher
        break;
      case "yard":
        this.addNoiseDrone(600, 0.018);
        this.ambienceEvery = [3, 7];
        this.ambienceEvent = () => {
          const t = now();
          this.blip(430, 0.07, "square", 0.14, t, 120, amb); // galinha
          this.blip(360, 0.08, "square", 0.12, t + 0.09, -80, amb);
        };
        break;
      case "street":
        this.addNoiseDrone(380, 0.045); // tráfego distante
        this.addDrone(55, "sawtooth", 0.025);
        this.ambienceEvery = [2.5, 6];
        this.ambienceEvent = () => this.blip(180, 0.25, "sawtooth", 0.14, now(), 20, amb); // buzina
        break;
      case "chaos":
        this.addDrone(50, "sawtooth", 0.05);
        this.addDrone(75.5, "square", 0.03); // batimento tenso
        this.ambienceEvery = [1, 2.6];
        this.ambienceEvent = () =>
          this.blip(120 + Math.random() * 220, 0.2, "sawtooth", 0.12, now(), -40, amb);
        break;
      case "calm":
        this.addDrone(midi(48), "sine", 0.05);
        this.addDrone(midi(55), "sine", 0.03); // pad quente
        this.ambienceEvery = [3, 6];
        this.ambienceEvent = () => this.blip(midi(72), 0.5, "sine", 0.1, now(), 0, amb); // carrilhão
        break;
    }
  }

  // ─── SFX ───────────────────────────────────────────────────────────────
  /** Oscilador único com envelope ADSR curto. */
  private blip(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    when: number,
    bend = 0,
    dest: GainNode | null = null,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (bend !== 0)
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq + bend), when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(dest ?? this.sfxGain!);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  /** Rajada de ruído filtrado (whoosh / susto / quebra). */
  private noise(
    dur: number,
    gain: number,
    filterHz: number,
    when: number,
    sweep = 0,
    dest: GainNode | null = null,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterHz, when);
    if (sweep !== 0)
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, filterHz + sweep), when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest ?? this.sfxGain!);
    src.start(when);
    src.stop(when + dur);
  }

  /** Toca um efeito sonoro. Seguro chamar a qualquer momento. */
  sfx(name: SfxName): void {
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;

    switch (name) {
      case "uiMove":
        this.blip(520, 0.07, "square", 0.25, t);
        break;
      case "uiConfirm":
        this.blip(660, 0.08, "square", 0.3, t);
        this.blip(990, 0.12, "square", 0.25, t + 0.06);
        break;
      case "uiBack":
        this.blip(440, 0.09, "square", 0.28, t, -160);
        break;
      case "bark":
        // au-au: dois pulsos curtos com queda de pitch
        this.blip(320, 0.1, "sawtooth", 0.5, t, -140);
        this.blip(300, 0.12, "sawtooth", 0.45, t + 0.14, -120);
        break;
      case "meow":
        // miado: sobe e desce
        this.blip(540, 0.18, "triangle", 0.4, t, 180);
        this.blip(720, 0.16, "triangle", 0.35, t + 0.16, -260);
        break;
      case "whoosh":
        this.noise(0.3, 0.4, 700, t, 900);
        break;
      case "pickup":
        this.blip(700, 0.06, "triangle", 0.35, t);
        this.blip(1050, 0.08, "triangle", 0.3, t + 0.05);
        break;
      case "deliver":
        // arpejo ascendente alegre
        this.blip(660, 0.09, "square", 0.35, t);
        this.blip(880, 0.09, "square", 0.35, t + 0.08);
        this.blip(1320, 0.14, "square", 0.32, t + 0.16);
        break;
      case "broke":
        this.noise(0.25, 0.5, 1200, t, -900);
        this.blip(160, 0.18, "sawtooth", 0.3, t, -80);
        break;
      case "stun":
        this.blip(880, 0.2, "sine", 0.3, t, -500);
        this.noise(0.2, 0.25, 2000, t);
        break;
      case "step": {
        // patinha no chão: tick curto e grave, com leve variação de tom
        const f = 150 + Math.random() * 60;
        this.blip(f, 0.05, "sine", 0.16, t, -50);
        this.noise(0.04, 0.1, 1400, t);
        break;
      }
      case "win": {
        // fanfarra (abaixa a música por baixo)
        this.duckMusic(1.6);
        const seq = [60, 64, 67, 72, 76];
        seq.forEach((m, i) => this.blip(midi(m), 0.22, "square", 0.4, t + i * 0.12));
        this.blip(midi(79), 0.5, "square", 0.4, t + seq.length * 0.12);
        break;
      }
      case "lose": {
        // descida triste (abaixa a música por baixo)
        this.duckMusic(1.4);
        const seq = [60, 58, 55, 51];
        seq.forEach((m, i) => this.blip(midi(m), 0.3, "triangle", 0.4, t + i * 0.18, -20));
        break;
      }
    }
  }

  // ─── Música ──────────────────────────────────────────────────────────────
  /** Troca a trilha em loop (no-op se já for a atual). */
  music(track: MusicTrack | null): void {
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    this.ensure();
    if (track === null) {
      this.stopScheduler();
      return;
    }
    this.startScheduler();
  }

  stopMusic(): void {
    this.music(null);
  }

  private startScheduler(): void {
    this.stopScheduler();
    const ctx = this.ctx;
    if (!ctx || !this.currentTrack) return;
    if (ctx.state === "suspended") void ctx.resume();
    this.nextLoopStart = ctx.currentTime + 0.1;
    // lookahead simples: agenda o próximo loop com antecedência
    this.schedulerId = window.setInterval(() => this.tick(), 50);
    this.tick();
  }

  private stopScheduler(): void {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.currentTrack) return;
    const def = this.tracks[this.currentTrack];
    // agenda enquanto o início do próximo loop estiver dentro de ~200ms à frente
    while (this.nextLoopStart < ctx.currentTime + 0.2) {
      for (const n of def.notes) {
        this.blip(
          n.f,
          n.d,
          n.type ?? "triangle",
          n.g ?? 0.4,
          this.nextLoopStart + n.t,
          0,
          this.musicGain, // roteia pelo barramento de música
        );
      }
      this.nextLoopStart += def.loop;
    }
  }
}

/** Singleton global de áudio. */
export const Audio = new AudioManager();
