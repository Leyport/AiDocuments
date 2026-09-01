import { Component, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { AuthService } from '../../auth.service';
import { AppDocument, DocumentsService } from '../../documents.service';
import { DocumentAnalysisService } from '../../document-analysis.service';

@Component({
  selector: 'app-document-chat',
  imports: [],
  templateUrl: './document-chat.html',
  styleUrl: './document-chat.scss'
})
export class DocumentChat {
  private readonly auth = inject(AuthService);
  private readonly documentsService = inject(DocumentsService);
  private readonly documentAnalysisService = inject(DocumentAnalysisService);

  readonly document = input.required<AppDocument>();

  protected readonly messages = toSignal(
    toObservable(this.document).pipe(
      switchMap((document) => this.documentsService.getMessages(document.id, this.auth.currentUser()!.uid))
    ),
    { initialValue: [] }
  );

  protected readonly question = signal('');
  protected readonly isAsking = signal(false);
  protected readonly errorMessage = signal<string | undefined>(undefined);

  protected onQuestionInput(event: Event): void {
    this.question.set((event.target as HTMLInputElement).value);
  }

  protected async onAsk(): Promise<void> {
    const text = this.question().trim();
    const uid = this.auth.currentUser()?.uid;
    if (!text || !uid) {
      return;
    }

    this.isAsking.set(true);
    this.errorMessage.set(undefined);
    const priorMessages = this.messages();
    this.question.set('');

    try {
      await this.documentAnalysisService.askFollowUp(this.document(), uid, text, priorMessages);
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to ask question');
    } finally {
      this.isAsking.set(false);
    }
  }
}
