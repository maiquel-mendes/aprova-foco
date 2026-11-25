import type {
  BaseRepository,
  RepositoryContext,
} from '../../repositories/BaseRepository.ts';
import type {
  AdminUserItem,
  MockExamRecord,
  PdfImportHistory,
  QuestionItem,
  RankingEntry,
  UserProfile,
  UserRole,
} from '../../types.ts';
import type {
  AuthSessionUser,
  MockExamSubmitResult,
  PdfImportCommitPayload,
  QuestionFilters,
  QuestionMutationPayload,
  UserPreferencesUpdate,
  WorkspaceSyncResult,
} from '../../repositories/contracts.ts';
import { getPgDb } from '../db/client.ts';
import {
  pgActivateStudyProfile,
  pgCommitPdfQuestions,
  pgCreateForumPost,
  pgCreateManualQuestion,
  pgCreateSchedule,
  pgCreateStudyProfile,
  pgDeletePdfImport,
  pgDeleteQuestion,
  pgDeleteSchedule,
  pgExportBackup,
  pgFetchOfflinePack,
  pgFindMockExamById,
  pgFindPdfImportById,
  pgFindQuestionById,
  pgFindUserById,
  pgGetAnalytics,
  pgListAdminUsers,
  pgListChatMessages,
  pgListForumPosts,
  pgListMockExamsAndRankings,
  pgListPdfImports,
  pgListScrapeHistory,
  pgListSchedules,
  pgQueryQuestions,
  pgReplyForumPost,
  pgSaveChatMessage,
  pgSaveScrapedQuestions,
  pgSubmitAttempt,
  pgSubmitMockExam,
  pgSyncWorkspace,
  pgUpdatePreferences,
  pgUpdateQuestion,
  pgUpdateSchedule,
  pgUpdateUserRole,
  pgUpvoteForumPost,
} from './postgres.ts';

export abstract class PostgresRepository<
  TEntity,
  TCreateInput = Partial<TEntity>,
  TUpdateInput = Partial<TEntity>,
  TFilter = Record<string, unknown>,
  TListResult = TEntity[],
> implements
    BaseRepository<TEntity, TCreateInput, TUpdateInput, TFilter, TListResult>
{
  abstract readonly entityName: string;

  protected get db() {
    return getPgDb();
  }

  protected requireUid(context?: RepositoryContext): string {
    if (!context?.uid) {
      throw new Error(
        `Usuário autenticado obrigatório para ${this.entityName}.`
      );
    }
    return context.uid;
  }

  abstract findById(
    id: string,
    context?: RepositoryContext
  ): Promise<TEntity | null>;
  abstract findAll(
    filters?: TFilter,
    context?: RepositoryContext
  ): Promise<TListResult>;
  abstract create(
    data: TCreateInput,
    context?: RepositoryContext
  ): Promise<TEntity>;
  abstract update(
    id: string,
    data: TUpdateInput,
    context?: RepositoryContext
  ): Promise<TEntity>;
  abstract delete(id: string, context?: RepositoryContext): Promise<void>;
}

export class PostgresUserRepository extends PostgresRepository<
  UserProfile,
  AuthSessionUser,
  UserPreferencesUpdate,
  RepositoryContext,
  AdminUserItem[]
> {
  readonly entityName = 'users';

  findById(id: string): Promise<UserProfile | null> {
    return pgFindUserById(id);
  }

  findAll(): Promise<AdminUserItem[]> {
    return pgListAdminUsers();
  }

  async create(data: AuthSessionUser): Promise<UserProfile> {
    const res = await this.syncWorkspace(data);
    return res.user;
  }

  update(id: string, data: UserPreferencesUpdate): Promise<UserProfile> {
    return pgUpdatePreferences(id, data);
  }

  async delete(): Promise<void> {
    throw new Error('Exclusão direta de usuário não permitida.');
  }

  syncWorkspace(authUser: AuthSessionUser): Promise<WorkspaceSyncResult> {
    return pgSyncWorkspace(authUser.uid);
  }

  updatePreferences(uid: string, updates: UserPreferencesUpdate) {
    return pgUpdatePreferences(uid, updates);
  }

  createStudyProfile(
    uid: string,
    payload: {
      name: string;
      career: string;
      targetBoard: string;
      examDate?: string | null;
      dailyHours?: number;
    }
  ) {
    return pgCreateStudyProfile(uid, payload);
  }

  activateStudyProfile(uid: string, profileId: string) {
    return pgActivateStudyProfile(uid, profileId);
  }

  listAdminUsers() {
    return pgListAdminUsers();
  }

  updateUserRole(targetUid: string, nextRole: UserRole) {
    return pgUpdateUserRole(targetUid, nextRole);
  }
}

export class PostgresQuestionRepository extends PostgresRepository<
  QuestionItem,
  QuestionMutationPayload,
  QuestionMutationPayload,
  QuestionFilters,
  { questions: QuestionItem[]; total: number }
> {
  readonly entityName = 'questions';

  findById(
    id: string,
    context?: RepositoryContext
  ): Promise<QuestionItem | null> {
    return pgFindQuestionById(id, context?.uid);
  }

  findAll(
    filters: QuestionFilters = {},
    context?: RepositoryContext
  ): Promise<{ questions: QuestionItem[]; total: number }> {
    return pgQueryQuestions(this.requireUid(context), filters);
  }

  create(
    data: QuestionMutationPayload,
    context?: RepositoryContext
  ): Promise<QuestionItem> {
    return pgCreateManualQuestion(this.requireUid(context), data);
  }

  update(
    id: string,
    data: QuestionMutationPayload
  ): Promise<QuestionItem> {
    return pgUpdateQuestion(id, data);
  }

  delete(id: string): Promise<void> {
    return pgDeleteQuestion(id);
  }

  query(uid: string, filters: QuestionFilters) {
    return pgQueryQuestions(uid, filters);
  }

  fetchOfflinePack() {
    return pgFetchOfflinePack();
  }

  submitAttempt(
    uid: string,
    payload: {
      questionId: string;
      selectedOption: string;
      timeSpentSec?: number;
      profileId?: string | null;
      isBookmarked?: boolean;
    }
  ) {
    return pgSubmitAttempt(uid, payload);
  }
}

export interface ServerMockExamSubmitPayload {
  title: string;
  board: string;
  career: string;
  durationMinutes: number;
  elapsedSeconds: number;
  cebraspePenalty: boolean;
  questionIds: string[];
  answers: Record<string, string>;
}

export class PostgresMockExamRepository extends PostgresRepository<
  MockExamRecord,
  ServerMockExamSubmitPayload,
  Partial<MockExamRecord>,
  RepositoryContext,
  { myExams: MockExamRecord[]; rankings: RankingEntry[] }
> {
  readonly entityName = 'mock_exams';

  findById(
    id: string,
    context?: RepositoryContext
  ): Promise<MockExamRecord | null> {
    return pgFindMockExamById(id, this.requireUid(context));
  }

  findAll(
    filters?: RepositoryContext,
    context?: RepositoryContext
  ): Promise<{ myExams: MockExamRecord[]; rankings: RankingEntry[] }> {
    return pgListMockExamsAndRankings(this.requireUid(context || filters));
  }

  async create(
    data: ServerMockExamSubmitPayload,
    context?: RepositoryContext
  ): Promise<MockExamRecord> {
    const res = await this.submit(this.requireUid(context), data);
    return res.exam;
  }

  async update(): Promise<MockExamRecord> {
    throw new Error('Simulados finalizados são imutáveis.');
  }

  async delete(): Promise<void> {
    throw new Error('Exclusão de simulados finalizados não permitida.');
  }

  listAndRankings(uid: string) {
    return pgListMockExamsAndRankings(uid);
  }

  submit(
    uid: string,
    payload: ServerMockExamSubmitPayload
  ): Promise<MockExamSubmitResult> {
    return pgSubmitMockExam(uid, payload);
  }
}

export class PostgresPdfImportRepository extends PostgresRepository<
  PdfImportHistory,
  PdfImportCommitPayload,
  Partial<PdfImportHistory>,
  RepositoryContext,
  PdfImportHistory[]
> {
  readonly entityName = 'pdf_imports';

  findById(id: string): Promise<PdfImportHistory | null> {
    return pgFindPdfImportById(id);
  }

  findAll(): Promise<PdfImportHistory[]> {
    return pgListPdfImports();
  }

  async create(
    data: PdfImportCommitPayload,
    context?: RepositoryContext
  ): Promise<PdfImportHistory> {
    const res = await pgCommitPdfQuestions(this.requireUid(context), data);
    return {
      id: `pdf_${Date.now()}`,
      title: data.title,
      fileName: data.fileName,
      board: data.board,
      career: data.career,
      year: data.year,
      extractedCount: res.insertedCount,
      status: 'processed',
      createdAt: new Date().toISOString(),
    };
  }

  async update(): Promise<PdfImportHistory> {
    throw new Error('Registros de importação PDF são imutáveis.');
  }

  delete(id: string): Promise<void> {
    return pgDeletePdfImport(id);
  }
}

export class PostgresServerRepositoryAdapter {
  readonly driver = 'postgres' as const;
  readonly users = new PostgresUserRepository();
  readonly questions = new PostgresQuestionRepository();
  readonly mockExams = new PostgresMockExamRepository();
  readonly pdfImports = new PostgresPdfImportRepository();
  readonly scraper = {
    listHistory: pgListScrapeHistory,
    saveScraped: pgSaveScrapedQuestions,
  };
  readonly dashboard = {
    getAnalytics: pgGetAnalytics,
    listSchedules: pgListSchedules,
    createSchedule: pgCreateSchedule,
    updateSchedule: pgUpdateSchedule,
    deleteSchedule: pgDeleteSchedule,
    exportBackup: pgExportBackup,
  };
  readonly community = {
    listForumPosts: pgListForumPosts,
    createForumPost: pgCreateForumPost,
    replyForumPost: pgReplyForumPost,
    upvoteForumPost: pgUpvoteForumPost,
    listChatMessages: pgListChatMessages,
    saveChatMessage: pgSaveChatMessage,
  };
}

let cachedServerAdapter: PostgresServerRepositoryAdapter | null = null;

export function getPostgresServerRepositories(): PostgresServerRepositoryAdapter {
  if (!cachedServerAdapter) {
    cachedServerAdapter = new PostgresServerRepositoryAdapter();
  }
  return cachedServerAdapter;
}
