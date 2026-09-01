import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../auth.service';
import { DocumentsService } from '../../documents.service';
import { DocumentAnalysisService } from '../../document-analysis.service';
import { ReportsService } from '../../reports.service';
import { DOCUMENT_CATEGORIES, DocumentCategoryId } from '../../document-category';
import { DocumentUpload } from '../document-upload/document-upload';
import { DocumentList } from '../document-list/document-list';
import { ReadAloud } from '../../read-aloud/read-aloud';
import { SpeechService } from '../../speech.service';

@Component({
  selector: 'app-documents-page',
  imports: [DocumentUpload, DocumentList, ReadAloud],
  templateUrl: './documents-page.html',
  styleUrl: './documents-page.scss'
})
export class DocumentsPage {
  private readonly auth = inject(AuthService);
  private readonly documentsService = inject(DocumentsService);
  private readonly documentAnalysisService = inject(DocumentAnalysisService);
  private readonly reportsService = inject(ReportsService);
  protected readonly speechService = inject(SpeechService);

  protected readonly categories = DOCUMENT_CATEGORIES;
  protected readonly selectedCategory = signal<DocumentCategoryId | 'all'>('all');
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly isGeneratingReport = signal(false);
  protected readonly reportError = signal<string | undefined>(undefined);

  private readonly documents = toSignal(
    this.documentsService.getDocuments(this.auth.currentUser()!.uid),
    { initialValue: [] }
  );

  protected readonly reports = toSignal(
    this.reportsService.getReports(this.auth.currentUser()!.uid),
    { initialValue: [] }
  );

  protected readonly filteredDocuments = computed(() => {
    const category = this.selectedCategory();
    const documents = this.documents();
    return category === 'all' ? documents : documents.filter((d) => d.category === category);
  });

  protected onVoiceChange(event: Event): void {
    this.speechService.setVoice((event.target as HTMLSelectElement).value);
  }

  protected onFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as DocumentCategoryId | 'all';
    this.selectedCategory.set(value);
  }

  protected onToggleSelect(docId: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(docId)) {
      next.delete(docId);
    } else {
      next.add(docId);
    }
    this.selectedIds.set(next);
  }

  protected async onGenerateReport(): Promise<void> {
    const uid = this.auth.currentUser()?.uid;
    const selected = this.documents().filter((d) => this.selectedIds().has(d.id));
    if (!uid || selected.length < 2) {
      return;
    }

    this.isGeneratingReport.set(true);
    this.reportError.set(undefined);

    try {
      const content = await this.documentAnalysisService.generateCombinedReport(selected);
      await this.reportsService.addReport(
        uid,
        selected.map((d) => d.id),
        selected.map((d) => d.fileName),
        content
      );
      this.selectedIds.set(new Set());
    } catch (err: unknown) {
      this.reportError.set(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      this.isGeneratingReport.set(false);
    }
  }
}
