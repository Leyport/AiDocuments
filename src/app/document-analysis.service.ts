import { Service, inject } from '@angular/core';
import { Content, InlineDataPart, Schema, getGenerativeModel } from 'firebase/ai';
import { serverTimestamp } from '@angular/fire/firestore';
import { AI_INSTANCE } from './firebase-ai';
import { AppDocument, DocumentsService } from './documents.service';
import { ChatMessage } from './chat-message';
import { DOCUMENT_CATEGORIES } from './document-category';

interface AnalysisResult {
  summary: string;
  translatedText?: string;
}

const HTML_FORMAT_INSTRUCTION =
  'Format the value as simple HTML using only <h3>, <p>, <ul>, <li>, <strong>, and <br> tags for ' +
  'readability: an <h3> heading per section, <p> paragraphs, and a <ul> of <li> items for any action ' +
  'items or deadlines. Do not include <html>, <head>, <body>, <script>, style attributes, or any other tags.';

@Service()
export class DocumentAnalysisService {
  private readonly ai = inject(AI_INSTANCE);
  private readonly documentsService = inject(DocumentsService);

  private readonly model = getGenerativeModel(this.ai, {
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: Schema.object({
        properties: {
          summary: Schema.string({
            description: `A plain-English explanation of what the document says and any action needed. ${HTML_FORMAT_INSTRUCTION}`
          }),
          translatedText: Schema.string({
            description: `An English translation of the document's key text. ${HTML_FORMAT_INSTRUCTION}`
          })
        },
        optionalProperties: ['translatedText']
      })
    }
  });

  private readonly chatModel = getGenerativeModel(this.ai, { model: 'gemini-2.5-flash' });

  async analyze(document: AppDocument, file: Blob): Promise<void> {
    await this.documentsService.updateDocument(document.id, { status: 'analyzing' });

    try {
      const isSpreadsheet = this.isTextualDocument(document.mimeType);
      const filePart = isSpreadsheet
        ? { text: `Contents of the uploaded file "${document.fileName}":\n\n${await file.text()}` }
        : await this.toInlineDataPart(file, document.mimeType);
      const prompt = this.buildPrompt(document.category, isSpreadsheet);
      const result = await this.model.generateContent([prompt, filePart]);
      const analysis = JSON.parse(result.response.text()) as AnalysisResult;

      await this.documentsService.updateDocument(document.id, {
        status: 'analyzed',
        summary: analysis.summary,
        ...(analysis.translatedText ? { translatedText: analysis.translatedText } : {}),
        analyzedAt: serverTimestamp()
      });
    } catch (err: unknown) {
      await this.documentsService.updateDocument(document.id, {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Analysis failed'
      });
    }
  }

  async askFollowUp(
    document: AppDocument,
    uid: string,
    question: string,
    priorMessages: ChatMessage[]
  ): Promise<void> {
    await this.documentsService.addMessage(document.id, uid, 'user', question);

    try {
      const history: Content[] = priorMessages.map((message) => ({
        role: message.role,
        parts: [{ text: message.text }]
      }));
      const chat = this.chatModel.startChat({
        systemInstruction: this.buildContextPrompt(document),
        history
      });
      const result = await chat.sendMessage(question);
      await this.documentsService.addMessage(document.id, uid, 'model', result.response.text());
    } catch (err: unknown) {
      await this.documentsService.addMessage(
        document.id,
        uid,
        'model',
        err instanceof Error ? `Sorry, I couldn't answer that: ${err.message}` : "Sorry, I couldn't answer that."
      );
    }
  }

  async generateCombinedReport(documents: AppDocument[]): Promise<string> {
    const prompt = this.buildCombinedPrompt(documents);
    const result = await this.chatModel.generateContent(prompt);
    return result.response.text();
  }

  private buildCombinedPrompt(documents: AppDocument[]): string {
    const sections = documents
      .map((document) => {
        const category = DOCUMENT_CATEGORIES.find((c) => c.id === document.category)?.label ?? document.category;
        const translation = document.translatedText ? `Translation: ${document.translatedText}\n` : '';
        return `Document "${document.fileName}" (category: ${category}):\n${translation}Summary: ${document.summary ?? ''}`;
      })
      .join('\n\n');

    return 'The following are summaries of several documents that all belong to the same person. ' +
      'Review them together as a whole, not in isolation. Point out anything notable that only ' +
      "becomes clear by comparing them — patterns, connections, conflicting dates or deadlines, or " +
      'anything worth flagging that isn\'t obvious from any single document alone. Then give clear, ' +
      'practical recommendations for what the person should do next, based on all these documents ' +
      `combined.\n\n${sections}\n\n${HTML_FORMAT_INSTRUCTION}`;
  }

  private buildContextPrompt(document: AppDocument): string {
    const parts = [`You already summarized a document for the user as follows: "${document.summary ?? ''}"`];
    if (document.translatedText) {
      parts.push(`You also translated it to English as follows: "${document.translatedText}"`);
    }
    parts.push(
      'Answer the user\'s follow-up questions about this document based only on the above. ' +
        'Keep answers brief and plain English. If something isn\'t covered by the summary or ' +
        'translation, say you don\'t have enough information from the document to answer.'
    );
    return parts.join(' ');
  }

  private buildPrompt(category: AppDocument['category'], isSpreadsheet: boolean): string {
    const kind = isSpreadsheet
      ? 'This document is a CSV spreadsheet, provided as raw text. Read the columns and rows, '
        + 'and in "summary" describe what data it holds, call out notable figures, totals or trends, '
        + 'and any rows that need attention. '
      : '';

    if (category === 'france-house') {
      return `${kind}This document is in French and relates to a house in France. ` +
        'Translate the key text to English in "translatedText". ' +
        'In "summary", explain in plain English what the document says and ' +
        `what action, if any, the recipient needs to take, and by when. ${HTML_FORMAT_INSTRUCTION}`;
    }
    return `${kind}In "summary", explain in plain English what this document says and ` +
      `what action, if any, the recipient needs to take, and by when. ${HTML_FORMAT_INSTRUCTION}`;
  }

  private isTextualDocument(mimeType: string): boolean {
    return mimeType.startsWith('text/');
  }

  private toInlineDataPart(file: Blob, mimeType: string): Promise<InlineDataPart> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.slice(result.indexOf(',') + 1);
        resolve({ inlineData: { data: base64, mimeType } });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
