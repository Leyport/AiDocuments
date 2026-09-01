import { Component, ElementRef, computed, effect, inject, input, viewChild } from '@angular/core';
import { SpeechService } from '../speech.service';

@Component({
  selector: 'app-read-aloud',
  imports: [],
  template: `
    <div class="content" #contentEl [innerHTML]="content()"></div>

    @if (speechService.isSupported()) {
      <div class="speech-controls">
        @if (!isActive()) {
          <button type="button" class="speech-btn" (click)="onStart()">🔊 Read aloud</button>
        } @else {
          @if (isPaused()) {
            <button type="button" class="speech-btn" (click)="speechService.resume()">▶ Resume</button>
          } @else {
            <button type="button" class="speech-btn" (click)="speechService.pause()">⏸ Pause</button>
          }
          <button type="button" class="speech-btn" (click)="speechService.previous()">⏮ Back</button>
          <span class="speech-progress" aria-live="polite">
            {{ (speechService.currentState()?.chunkIndex ?? 0) + 1 }} / {{ speechService.currentState()?.totalChunks }}
          </span>
          <button type="button" class="speech-btn" (click)="speechService.next()">⏭ Next</button>
          <button type="button" class="speech-btn" (click)="speechService.stop()">⏹ Stop</button>
        }
      </div>
    }
  `,
  styleUrl: './read-aloud.scss'
})
export class ReadAloud {
  protected readonly speechService = inject(SpeechService);

  readonly id = input.required<string>();
  readonly content = input.required<string>();

  private readonly contentEl = viewChild<ElementRef<HTMLElement>>('contentEl');
  private blocks: HTMLElement[] = [];

  protected readonly isActive = computed(() => this.speechService.isActive(this.id()));
  protected readonly isPaused = computed(() => this.speechService.isPaused(this.id()));

  constructor() {
    effect(() => {
      const state = this.speechService.currentState();
      for (const el of this.blocks) {
        el.classList.remove('speaking-highlight');
      }
      if (state && state.id === this.id()) {
        const el = this.blocks[state.chunkIndex];
        if (el) {
          el.classList.add('speaking-highlight');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }

  protected onStart(): void {
    const container = this.contentEl()?.nativeElement;
    if (!container) {
      return;
    }

    this.blocks = Array.from(container.querySelectorAll<HTMLElement>('h3, h4, p, li'));
    const chunks = this.blocks.map((el) => el.textContent?.trim() ?? '').filter((text) => text.length > 0);
    this.speechService.speak(this.id(), chunks);
  }
}
