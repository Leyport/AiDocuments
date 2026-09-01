import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Storage, getDownloadURL, ref } from '@angular/fire/storage';
import { AppDocument, DocumentsService, DocumentStatus } from '../../documents.service';
import { DOCUMENT_CATEGORIES } from '../../document-category';
import { DocumentChat } from '../document-chat/document-chat';
import { ReadAloud } from '../../read-aloud/read-aloud';

const STATUS_LABELS: Record<DocumentStatus, string> = {
  uploaded: 'Uploaded',
  analyzing: 'Analyzing',
  analyzed: 'Analyzed',
  error: 'Error'
};

@Component({
  selector: 'app-document-card',
  imports: [DocumentChat, ReadAloud],
  template: `
    <article class="document-card">
      <div class="card-thumb" aria-hidden="true">
        <span class="thumb-icon">{{ isImage() ? '🖼️' : '📄' }}</span>
      </div>

      <div class="card-body">
        <div class="card-header">
          <h3 class="file-name">{{ document().fileName }}</h3>
          <button
            type="button"
            class="delete-btn"
            [disabled]="isDeleting()"
            (click)="onDelete()"
          >
            {{ isDeleting() ? 'Deleting…' : 'Delete' }}
          </button>
        </div>

        <span class="category-badge">{{ categoryLabel() }}</span>
        <p class="status-text" [class.status-error]="document().status === 'error'">
          Status: {{ statusLabel() }}
        </p>

        @if (document().status === 'analyzing') {
          <p role="status" aria-live="polite">Analyzing…</p>
        }

        @if (document().status === 'analyzed') {
          <label class="select-label">
            <input type="checkbox" [checked]="selected()" (change)="onSelectionToggle($event)">
            Include in combined report
          </label>

          <button
            type="button"
            class="toggle-details-btn"
            [attr.aria-expanded]="detailsExpanded()"
            (click)="detailsExpanded.set(!detailsExpanded())"
          >
            {{ detailsExpanded() ? 'Hide details' : 'Show details' }}
          </button>

          @if (detailsExpanded()) {
            <app-read-aloud [id]="document().id" [content]="combinedAnalysisHtml()" />

            <app-document-chat [document]="document()" />
          }
        }

        @if (document().status === 'error') {
          <p class="status-text status-error">{{ document().errorMessage }}</p>
        }

        <button type="button" class="view-btn" (click)="viewOriginal()">View original</button>
      </div>
    </article>
  `,
  styleUrl: './document-card.scss'
})
export class DocumentCard {
  private readonly storage = inject(Storage);
  private readonly documentsService = inject(DocumentsService);

  readonly document = input.required<AppDocument>();
  readonly selected = input<boolean>(false);
  readonly selectionChange = output<boolean>();

  private readonly downloadUrl = signal<string | undefined>(undefined);
  protected readonly detailsExpanded = signal(true);
  protected readonly isDeleting = signal(false);

  protected readonly isImage = computed(() => this.document().mimeType.startsWith('image/'));

  protected readonly categoryLabel = computed(() => {
    const category = DOCUMENT_CATEGORIES.find((c) => c.id === this.document().category);
    return category?.label ?? this.document().category;
  });

  protected readonly statusLabel = computed(() => STATUS_LABELS[this.document().status]);

  protected readonly combinedAnalysisHtml = computed(() => {
    const document = this.document();
    const parts: string[] = [];
    if (document.translatedText) {
      parts.push(`<h4>Translation</h4>${document.translatedText}`);
    }
    parts.push(`<h4>Summary</h4>${document.summary ?? ''}`);
    return parts.join('');
  });

  protected onSelectionToggle(event: Event): void {
    this.selectionChange.emit((event.target as HTMLInputElement).checked);
  }

  protected async onDelete(): Promise<void> {
    const confirmed = window.confirm(`Delete "${this.document().fileName}"? This can't be undone.`);
    if (!confirmed) {
      return;
    }

    this.isDeleting.set(true);
    try {
      await this.documentsService.deleteDocument(
        this.document().id,
        this.document().storagePath,
        this.document().ownerUid
      );
    } catch (err: unknown) {
      this.isDeleting.set(false);
      window.alert(err instanceof Error ? `Failed to delete: ${err.message}` : 'Failed to delete document');
    }
  }

  protected async viewOriginal(): Promise<void> {
    let url = this.downloadUrl();
    if (!url) {
      const storageRef = ref(this.storage, this.document().storagePath);
      url = await getDownloadURL(storageRef);
      this.downloadUrl.set(url);
    }
    window.open(url, '_blank', 'noopener');
  }
}
