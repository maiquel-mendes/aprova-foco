import type { IAppRepositories } from '../contracts';
import { FirebaseRepositoryAdapter } from './FirebaseRepository';

export {
  FirebaseMockExamRepository,
  FirebasePdfImportRepository,
  FirebaseQuestionRepository,
  FirebaseRepository,
  FirebaseRepositoryAdapter,
  FirebaseUserRepository,
} from './FirebaseRepository';

export function createFirestoreRepositories(): IAppRepositories {
  return new FirebaseRepositoryAdapter();
}
