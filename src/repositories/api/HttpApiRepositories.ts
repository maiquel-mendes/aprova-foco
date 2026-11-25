import type { IAppRepositories } from '../contracts';
import { PostgresRepositoryAdapter } from '../postgres/PostgresRepository';

export {
  PostgresMockExamRepository,
  PostgresPdfImportRepository,
  PostgresQuestionRepository,
  PostgresRepository,
  PostgresRepositoryAdapter,
  PostgresUserRepository,
} from '../postgres/PostgresRepository';

export function createHttpApiRepositories(): IAppRepositories {
  return new PostgresRepositoryAdapter();
}
