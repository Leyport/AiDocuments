export interface Report {
  id: string;
  ownerUid: string;
  documentIds: string[];
  documentLabels: string[];
  content: string;
  createdAt: unknown;
}
