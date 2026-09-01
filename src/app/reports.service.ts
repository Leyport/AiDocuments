import { Service, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  CollectionReference,
  DocumentData
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Report } from './report';

@Service()
export class ReportsService {
  private readonly firestore = inject(Firestore);
  private readonly reportsCollection = collection(this.firestore, 'reports') as CollectionReference<DocumentData>;

  getReports(uid: string): Observable<Report[]> {
    const reportsQuery = query(this.reportsCollection, where('ownerUid', '==', uid), orderBy('createdAt', 'desc'));
    return collectionData(reportsQuery, { idField: 'id' }) as Observable<Report[]>;
  }

  async addReport(uid: string, documentIds: string[], documentLabels: string[], content: string): Promise<void> {
    await addDoc(this.reportsCollection, {
      ownerUid: uid,
      documentIds,
      documentLabels,
      content,
      createdAt: serverTimestamp()
    });
  }
}
