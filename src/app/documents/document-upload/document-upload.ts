import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../auth.service';
import { DocumentsService, AppDocument } from '../../documents.service';
import { DocumentAnalysisService } from '../../document-analysis.service';
import { DOCUMENT_CATEGORIES, DocumentCategoryId } from '../../document-category';

/**
 * Browsers report the MIME type of `.csv` files inconsistently (empty string, or
 * `application/vnd.ms-excel` when Excel is installed). Normalise so the stored
 * `mimeType` and the analysis step both see `text/csv`.
 */
function normalizeFileType(file: File): File {
  const extension = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
  if (extension === 'csv' && file.type !== 'text/csv') {
    return new File([file], file.name, { type: 'text/csv', lastModified: file.lastModified });
  }
  return file;
}

@Component({
  selector: 'app-document-upload',
  imports: [],
  templateUrl: './document-upload.html',
  styleUrl: './document-upload.scss'
})
export class DocumentUpload {
  private readonly auth = inject(AuthService);
  private readonly documentsService = inject(DocumentsService);
  private readonly documentAnalysisService = inject(DocumentAnalysisService);

  protected readonly categories = DOCUMENT_CATEGORIES;
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly selectedCategory = signal<DocumentCategoryId>('other');
  protected readonly uploadProgress = signal<number | undefined>(undefined);
  protected readonly errorMessage = signal<string | undefined>(undefined);
  protected readonly isUploading = signal(false);

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file ? normalizeFileType(file) : null);
  }

  protected onCategoryChange(categoryId: DocumentCategoryId): void {
    this.selectedCategory.set(categoryId);
  }

  protected async onSubmit(): Promise<void> {
    const file = this.selectedFile();
    const uid = this.auth.currentUser()?.uid;
    if (!file || !uid) {
      return;
    }

    this.isUploading.set(true);
    this.errorMessage.set(undefined);
    this.uploadProgress.set(0);

    try {
      const category = this.selectedCategory();
      const { docId, storagePath, progress$ } = await this.documentsService.uploadDocument(file, category, uid);

      await new Promise<void>((resolve, reject) => {
        progress$.subscribe({
          next: (progress) => this.uploadProgress.set(progress),
          error: reject,
          complete: () => resolve()
        });
      });

      const uploadedDocument: AppDocument = {
        id: docId,
        ownerUid: uid,
        category,
        fileName: file.name,
        storagePath,
        mimeType: file.type,
        sizeBytes: file.size,
        status: 'uploaded',
        createdAt: null
      };
      this.documentAnalysisService.analyze(uploadedDocument, file).catch((err: unknown) => {
        console.error('Analysis failed', err);
      });

      this.selectedFile.set(null);
      this.selectedCategory.set('other');
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      this.isUploading.set(false);
      this.uploadProgress.set(undefined);
    }
  }
}
