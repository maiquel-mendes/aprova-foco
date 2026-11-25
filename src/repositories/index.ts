import { LocalApiAuthAdapter } from './api/LocalApiAuthAdapter';
import type {
  DataDriver,
  IAppRepositories,
  IAuthProvider,
} from './contracts';
import { FirebaseAuthAdapter } from './firebase/FirebaseAuthAdapter';
import {
  FirebaseRepository,
  FirebaseRepositoryAdapter,
} from './firebase/FirebaseRepository';
import {
  PostgresRepository,
  PostgresRepositoryAdapter,
} from './postgres/PostgresRepository';

export type { BaseRepository, RepositoryContext } from './BaseRepository';
export type {
  AuthSessionUser,
  DataDriver,
  IAppRepositories,
  IAuthProvider,
  ICommunityRepository,
  IDashboardRepository,
  IMockExamRepository,
  IPdfImportRepository,
  IQuestionRepository,
  IScraperRepository,
  IUserRepository,
} from './contracts';
export { FirebaseRepository, FirebaseRepositoryAdapter, PostgresRepository, PostgresRepositoryAdapter };

let cachedDriver: DataDriver | null = null;
let cachedAuthProvider: IAuthProvider | null = null;
let cachedRepositories: IAppRepositories | null = null;

export function getDataDriver(): DataDriver {
  if (!cachedDriver) {
    const raw = (import.meta.env.VITE_DATA_DRIVER || 'firebase')
      .trim()
      .toLowerCase();
    cachedDriver = raw === 'postgres' || raw === 'api' ? 'postgres' : 'firebase';
  }
  return cachedDriver;
}

export function getAuthProvider(): IAuthProvider {
  if (!cachedAuthProvider) {
    cachedAuthProvider =
      getDataDriver() === 'postgres'
        ? new LocalApiAuthAdapter()
        : new FirebaseAuthAdapter();
  }
  return cachedAuthProvider;
}

export function getRepositories(): IAppRepositories {
  if (!cachedRepositories) {
    cachedRepositories =
      getDataDriver() === 'postgres'
        ? new PostgresRepositoryAdapter()
        : new FirebaseRepositoryAdapter();
  }
  return cachedRepositories;
}
