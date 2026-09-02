import { Component, computed, input, output } from '@angular/core';
import { AppDocument } from '../../documents.service';
import { DOCUMENT_CATEGORIES } from '../../document-category';
import { DocumentCard } from '../document-card/document-card';

export type DocumentSort = 'added' | 'date' | 'doctor';

const UNKNOWN_AUTHOR = 'Unknown doctor';

interface DocumentGroup {
  key: string;
  /** Heading for the group; an empty string renders no heading. */
  label: string;
  documents: AppDocument[];
}

/** Newest document date first; documents without a date sort to the end (keeping input order). */
function byDocumentDateDesc(a: AppDocument, b: AppDocument): number {
  const dateA = a.documentDate ?? '';
  const dateB = b.documentDate ?? '';
  if (dateA && dateB) {
    return dateB.localeCompare(dateA);
  }
  return dateA ? -1 : dateB ? 1 : 0;
}

function compareAuthors(a: string, b: string): number {
  if (a === UNKNOWN_AUTHOR) {
    return 1;
  }
  if (b === UNKNOWN_AUTHOR) {
    return -1;
  }
  return a.localeCompare(b);
}

function groupByCategory(documents: AppDocument[]): DocumentGroup[] {
  return DOCUMENT_CATEGORIES.map((category) => ({
    key: category.id,
    label: category.label,
    documents: documents.filter((d) => d.category === category.id)
  })).filter((group) => group.documents.length > 0);
}

function groupByAuthor(documents: AppDocument[]): DocumentGroup[] {
  const groups = new Map<string, AppDocument[]>();
  for (const document of documents) {
    const label = document.author?.trim() || UNKNOWN_AUTHOR;
    const existing = groups.get(label);
    if (existing) {
      existing.push(document);
    } else {
      groups.set(label, [document]);
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => compareAuthors(a, b))
    .map(([label, groupDocuments]) => ({
      key: label,
      label,
      documents: [...groupDocuments].sort(byDocumentDateDesc)
    }));
}

@Component({
  selector: 'app-document-list',
  imports: [DocumentCard],
  templateUrl: './document-list.html',
  styleUrl: './document-list.scss'
})
export class DocumentList {
  readonly documents = input<AppDocument[]>([]);
  readonly selectedIds = input<ReadonlySet<string>>(new Set());
  readonly sortBy = input<DocumentSort>('added');
  readonly toggleSelect = output<string>();

  protected readonly groups = computed<DocumentGroup[]>(() => {
    const documents = this.documents();
    if (documents.length === 0) {
      return [];
    }
    switch (this.sortBy()) {
      case 'date':
        return [{ key: 'by-date', label: '', documents: [...documents].sort(byDocumentDateDesc) }];
      case 'doctor':
        return groupByAuthor(documents);
      default:
        return groupByCategory(documents);
    }
  });
}
