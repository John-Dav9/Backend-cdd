import { Injectable } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

@Injectable()
export class FirestoreRepository {
  constructor(private readonly firebase: FirebaseService) {}

  collection(path: string) {
    return this.firebase.firestore.collection(path);
  }

  doc(path: string, id: string) {
    return this.collection(path).doc(id);
  }

  async add(path: string, data: Record<string, any>) {
    return this.collection(path).add(data);
  }

  async getById(path: string, id: string) {
    return this.doc(path, id).get();
  }

  async update(path: string, id: string, data: Record<string, any>) {
    return this.doc(path, id).update(data);
  }

  async remove(path: string, id: string) {
    return this.doc(path, id).delete();
  }
}
