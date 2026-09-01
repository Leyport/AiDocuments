import { Service, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDocs,
  writeBatch,
  CollectionReference,
  DocumentData
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytesResumable, deleteObject } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { DocumentCategoryId } from './document-category';
import { ChatMessage } from './chat-message';

export type DocumentStatus = 'uploaded' | 'analyzing' | 'analyzed' | 'error';

export interface AppDocument {
  id: string;
  ownerUid: string;
  category: DocumentCategoryId;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  summary?: string;
  translatedText?: string;
  errorMessage?: string;
  createdAt: unknown;
  analyzedAt?: unknown;
}

export interface UploadResult {
  docId: string;
  storagePath: string;
  progress$: Observable<number>;
}

@Service()
export class DocumentsService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly documentsCollection = collection(
    this.firestore,
    'documents'
  ) as CollectionReference<DocumentData>;

  getDocuments(uid: string): Observable<AppDocument[]> {
    const documentsQuery = query(
      this.documentsCollection,
      where('ownerUid', '==', uid),
      orderBy('createdAt', 'desc')
    );
    return collectionData(documentsQuery, { idField: 'id' }) as Observable<AppDocument[]>;
  }

  getDocument(id: string): Observable<AppDocument | undefined> {
    const documentRef = doc(this.firestore, 'documents', id);
    return docData(documentRef, { idField: 'id' }) as Observable<AppDocument | undefined>;
  }

  async uploadDocument(file: File, category: DocumentCategoryId, uid: string): Promise<UploadResult> {
    const documentRef = doc(this.documentsCollection);
    const storagePath = `documents/${uid}/${documentRef.id}/${file.name}`;
    const storageRef = ref(this.storage, storagePath);

    const initialData: Omit<AppDocument, 'id'> = {
      ownerUid: uid,
      category,
      fileName: file.name,
      storagePath,
      mimeType: file.type,
      sizeBytes: file.size,
      status: 'uploaded',
      createdAt: serverTimestamp()
    };
    await setDoc(documentRef, initialData);

    const uploadTask = uploadBytesResumable(storageRef, file);
    const progress$ = new Observable<number>((subscriber) => {
      return uploadTask.on(
        'state_changed',
        (snapshot) => subscriber.next(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
        (error) => subscriber.error(error),
        () => subscriber.complete()
      );
    });

    return { docId: documentRef.id, storagePath, progress$ };
  }

  updateDocument(id: string, data: Partial<AppDocument>): Promise<void> {
    const documentRef = doc(this.firestore, 'documents', id);
    return updateDoc(documentRef, data);
  }

  async deleteDocument(id: string, storagePath: string, uid: string): Promise<void> {
    const documentRef = doc(this.firestore, 'documents', id);
    const storageRef = ref(this.storage, storagePath);
    const messagesCollection = collection(this.firestore, 'documents', id, 'messages');
    const messagesQuery = query(messagesCollection, where('ownerUid', '==', uid));
    const messagesSnapshot = await getDocs(messagesQuery);

    const batch = writeBatch(this.firestore);
    messagesSnapshot.forEach((messageDoc) => batch.delete(messageDoc.ref));
    batch.delete(documentRef);

    await Promise.allSettled([batch.commit(), deleteObject(storageRef)]);
  }

  getMessages(docId: string, uid: string): Observable<ChatMessage[]> {
    const messagesCollection = collection(
      this.firestore,
      'documents',
      docId,
      'messages'
    ) as CollectionReference<DocumentData>;
    const messagesQuery = query(messagesCollection, where('ownerUid', '==', uid), orderBy('createdAt', 'asc'));
    return collectionData(messagesQuery, { idField: 'id' }) as Observable<ChatMessage[]>;
  }

  async addMessage(docId: string, uid: string, role: ChatMessage['role'], text: string): Promise<void> {
    const messagesCollection = collection(this.firestore, 'documents', docId, 'messages');
    await addDoc(messagesCollection, { ownerUid: uid, role, text, createdAt: serverTimestamp() });
  }
}
