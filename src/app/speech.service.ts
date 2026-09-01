import { Service, signal } from '@angular/core';

export interface SpeechState {
  id: string;
  chunkIndex: number;
  totalChunks: number;
  isPaused: boolean;
}

const SPEECH_RATE = 0.85;
const VOICE_STORAGE_KEY = 'my-documents-app:speech-voice';

@Service()
export class SpeechService {
  private readonly state = signal<SpeechState | null>(null);
  private chunks: string[] = [];

  readonly currentState = this.state.asReadonly();
  readonly voices = signal<SpeechSynthesisVoice[]>([]);
  readonly selectedVoiceName = signal<string | null>(this.readStoredVoiceName());

  constructor() {
    if (this.isSupported()) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  isSpeaking(id: string): boolean {
    return this.state()?.id === id && !this.state()?.isPaused;
  }

  isPaused(id: string): boolean {
    return this.state()?.id === id && !!this.state()?.isPaused;
  }

  isActive(id: string): boolean {
    return this.state()?.id === id;
  }

  setVoice(name: string): void {
    this.selectedVoiceName.set(name);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOICE_STORAGE_KEY, name);
    }
  }

  speak(id: string, chunks: string[]): void {
    if (!this.isSupported() || chunks.length === 0) {
      return;
    }
    this.chunks = chunks;
    this.speakChunk(id, 0);
  }

  pause(): void {
    const current = this.state();
    if (!current || current.isPaused) {
      return;
    }
    window.speechSynthesis.cancel();
    this.state.set({ ...current, isPaused: true });
  }

  resume(): void {
    const current = this.state();
    if (current) {
      this.speakChunk(current.id, current.chunkIndex);
    }
  }

  next(): void {
    const current = this.state();
    if (current) {
      this.speakChunk(current.id, Math.min(current.chunkIndex + 1, current.totalChunks - 1));
    }
  }

  previous(): void {
    const current = this.state();
    if (current) {
      this.speakChunk(current.id, Math.max(current.chunkIndex - 1, 0));
    }
  }

  stop(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
    this.state.set(null);
    this.chunks = [];
  }

  private speakChunk(id: string, index: number): void {
    window.speechSynthesis.cancel();
    const text = this.chunks[index];
    if (!text) {
      this.stop();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = SPEECH_RATE;
    const voice = this.pickVoice();
    if (voice) {
      utterance.voice = voice;
    }
    utterance.onend = () => {
      const current = this.state();
      if (!current || current.id !== id || current.isPaused) {
        return;
      }
      const next = index + 1;
      if (next < this.chunks.length) {
        this.speakChunk(id, next);
      } else {
        this.stop();
      }
    };
    utterance.onerror = () => this.stop();

    this.state.set({ id, chunkIndex: index, totalChunks: this.chunks.length, isPaused: false });
    window.speechSynthesis.speak(utterance);
  }

  private loadVoices(): void {
    this.voices.set(window.speechSynthesis.getVoices());
  }

  private pickVoice(): SpeechSynthesisVoice | undefined {
    const voices = this.voices();
    const selectedName = this.selectedVoiceName();
    if (selectedName) {
      const match = voices.find((v) => v.name === selectedName);
      if (match) {
        return match;
      }
    }
    return voices.find((v) => v.lang.startsWith('en') && !v.localService) ?? voices.find((v) => v.lang.startsWith('en'));
  }

  private readStoredVoiceName(): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(VOICE_STORAGE_KEY) : null;
  }
}
