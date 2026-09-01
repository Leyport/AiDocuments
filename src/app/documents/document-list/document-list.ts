import { Component, computed, input, output } from '@angular/core';
import { AppDocument } from '../../documents.service';
import { DOCUMENT_CATEGORIES, DocumentCategoryId } from '../../document-category';
import { DocumentCard } from '../document-card/document-card';

interface CategoryGroup {
  id: DocumentCategoryId;
  label: string;
  documents: AppDocument[];
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
  readonly toggleSelect = output<string>();

  protected readonly groups = computed<CategoryGroup[]>(() => {
    const docs = this.documents();
    return DOCUMENT_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      documents: docs.filter((d) => d.category === category.id)
    })).filter((group) => group.documents.length > 0);
  });
}
