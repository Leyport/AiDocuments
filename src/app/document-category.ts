export const DOCUMENT_CATEGORIES = [
  { id: 'health', label: 'Health' },
  { id: 'france-house', label: 'France House' },
  { id: 'other', label: 'Other' },
] as const;

export type DocumentCategoryId = (typeof DOCUMENT_CATEGORIES)[number]['id'];
