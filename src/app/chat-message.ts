export interface ChatMessage {
  id: string;
  ownerUid: string;
  role: 'user' | 'model';
  text: string;
  createdAt: unknown;
}
