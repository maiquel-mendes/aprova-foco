import {
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import {
  OperationType,
  activateStudyProfile,
  commitPdfQuestionsToFirestore,
  createForumPost,
  createManualQuestion,
  createScheduleItem,
  createStudyProfile,
  deletePdfImportAndQuestions,
  deleteQuestion,
  deleteScheduleItem,
  exportUserBackupFromFirestore,
  fetchAdminUsers,
  fetchAnalyticsFromFirestore,
  fetchChatHistory,
  fetchForumPosts,
  fetchMockExamsAndRankings,
  fetchOfflinePackQuestions,
  fetchPdfImports,
  fetchSchedules,
  fetchScrapeHistory,
  handleFirestoreError,
  queryQuestions,
  replyForumPost,
  saveChatMessage,
  saveScrapedQuestionsToFirestore,
  submitMockExamToFirestore,
  submitQuestionAttempt,
  syncCurrentUserAndWorkspace,
  updateMyPreferences,
  updateQuestion,
  updateScheduleItem,
  updateUserRoleByAdmin,
  upvoteForumPost,
} from '../../lib/firestoreDb';
import type {
  AdminUserItem,
  MockExamRecord,
  PdfImportHistory,
  QuestionItem,
  RankingEntry,
  UserProfile,
  UserRole,
} from '../../types';
import type {
  AuthSessionUser,
  BaseRepository,
  IAppRepositories,
  ICommunityRepository,
  IDashboardRepository,
  IMockExamRepository,
  IPdfImportRepository,
  IQuestionRepository,
  IScraperRepository,
  IUserRepository,
  MockExamSubmitPayload,
  MockExamSubmitResult,
  PdfImportCommitPayload,
  QuestionFilters,
  QuestionMutationPayload,
  RepositoryContext,
  UserPreferencesUpdate,
} from '../contracts';

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof val === 'string' && val ? val : new Date().toISOString();
}

export abstract class FirebaseRepository<
  TEntity,
  TCreateInput = Partial<TEntity>,
  TUpdateInput = Partial<TEntity>,
  TFilter = Record<string, unknown>,
  TListResult = TEntity[],
> implements
    BaseRepository<TEntity, TCreateInput, TUpdateInput, TFilter, TListResult>
{
  abstract readonly entityName: string;
  protected readonly firestore = db;
  protected readonly firebaseAuth = auth;

  protected resolveUid(context?: RepositoryContext): string {
    const uid = context?.uid || this.firebaseAuth.currentUser?.uid;
    if (!uid) {
      throw new Error(
        `Contexto de usuário autenticado obrigatório para ${this.entityName}.`
      );
    }
    return uid;
  }

  protected async getDocumentData(
    collectionPath: string,
    id: string
  ): Promise<Record<string, unknown> | null> {
    const fullPath = `${collectionPath}/${id}`;
    try {
      const snap = await getDoc(doc(this.firestore, collectionPath, id));
      return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, fullPath);
    }
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

export class FirebaseUserRepository
  extends FirebaseRepository<
    UserProfile,
    AuthSessionUser,
    UserPreferencesUpdate,
    RepositoryContext,
    AdminUserItem[]
  >
  implements IUserRepository
{
  readonly entityName = 'users';

  async findById(id: string): Promise<UserProfile | null> {
    const data = await this.getDocumentData('users', id);
    if (!data) return null;
    return {
      id,
      uid: id,
      email: String(data.email || ''),
      displayName: (data.displayName as string) || null,
      avatarUrl: (data.avatarUrl as string) || null,
      role: (data.role as UserRole) || 'user',
      xp: Number(data.xp || 0),
      level: Number(data.level || 1),
      streakDays: Number(data.streakDays || 1),
      lastStudyDate: (data.lastStudyDate as string) || null,
      planTier: String(data.planTier || 'premium_trial'),
      dailyGoal: Number(data.dailyGoal || 20),
      pushEnabled: Boolean(data.pushEnabled),
      preferredTheme: data.preferredTheme === 'dark' ? 'dark' : 'light',
    };
  }

  async findAll(
    filters?: RepositoryContext,
    context?: RepositoryContext
  ): Promise<AdminUserItem[]> {
    const uid = this.resolveUid(context || filters);
    const email =
      context?.email ?? filters?.email ?? this.firebaseAuth.currentUser?.email;
    return this.listAdminUsers(uid, email);
  }

  async create(data: AuthSessionUser): Promise<UserProfile> {
    const synced = await this.syncWorkspace(data);
    return synced.user;
  }

  async update(
    id: string,
    data: UserPreferencesUpdate
  ): Promise<UserProfile> {
    return this.updatePreferences(id, data);
  }

  async delete(): Promise<void> {
    throw new Error(
      'Exclusão direta de conta de usuário desabilitada pelas regras de segurança do Firestore.'
    );
  }

  async syncWorkspace(authUser: AuthSessionUser) {
    const fbUser = this.firebaseAuth.currentUser;
    if (!fbUser || fbUser.uid !== authUser.uid) {
      throw new Error('Sessão Firebase não encontrada.');
    }
    return syncCurrentUserAndWorkspace(fbUser);
  }

  updatePreferences(uid: string, updates: UserPreferencesUpdate) {
    return updateMyPreferences(uid, updates);
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
    return createStudyProfile(uid, payload);
  }

  activateStudyProfile(uid: string, profileId: string) {
    return activateStudyProfile(uid, profileId);
  }

  listAdminUsers(uid: string, email?: string | null) {
    return fetchAdminUsers(uid, email);
  }

  updateUserRole(
    targetUid: string,
    nextRole: UserRole,
    currentAdminList: AdminUserItem[]
  ) {
    return updateUserRoleByAdmin(targetUid, nextRole, currentAdminList);
  }
}

export class FirebaseQuestionRepository
  extends FirebaseRepository<
    QuestionItem,
    QuestionMutationPayload,
    QuestionMutationPayload,
    QuestionFilters,
    { questions: QuestionItem[]; total: number }
  >
  implements IQuestionRepository
{
  readonly entityName = 'questions';

  async findById(id: string): Promise<QuestionItem | null> {
    const data = await this.getDocumentData('questions', id);
    if (!data) return null;
    return {
      id,
      code: String(data.code || id),
      board: String(data.board || 'FGV'),
      career: String(data.career || 'Tribunais'),
      subject: String(data.subject || 'Direito Constitucional'),
      topic: String(data.topic || 'Geral'),
      organ: String(data.organ || 'Diversos'),
      year: Number(data.year || 2025),
      difficulty: String(data.difficulty || 'Média'),
      questionType: String(data.questionType || 'multiple_choice'),
      statement: String(data.statement || ''),
      optionsJson: Array.isArray(data.optionsJson) ? data.optionsJson : [],
      correctOption: String(data.correctOption || 'A'),
      commentary: String(data.commentary || ''),
      sourceType: String(data.sourceType || 'curated'),
      pdfImportId: (data.pdfImportId as string) || undefined,
      createdByUserId: (data.createdByUserId as string) || undefined,
      createdAt: toIsoString(data.createdAt),
      userAttempt: null,
    };
  }

  findAll(
    filters: QuestionFilters = {},
    context?: RepositoryContext
  ): Promise<{ questions: QuestionItem[]; total: number }> {
    return this.query(this.resolveUid(context), filters);
  }

  create(
    data: QuestionMutationPayload,
    context?: RepositoryContext
  ): Promise<QuestionItem> {
    return createManualQuestion(this.resolveUid(context), data);
  }

  update(
    id: string,
    data: QuestionMutationPayload
  ): Promise<QuestionItem> {
    return updateQuestion(id, data);
  }

  delete(id: string): Promise<void> {
    return deleteQuestion(id);
  }

  query(uid: string, filters: QuestionFilters) {
    return queryQuestions(uid, filters);
  }

  fetchOfflinePack() {
    return fetchOfflinePackQuestions();
  }

  submitAttempt(
    uid: string,
    payload: {
      question: QuestionItem;
      selectedOption: string;
      timeSpentSec?: number;
      profileId?: string | null;
      isBookmarked?: boolean;
    }
  ) {
    return submitQuestionAttempt(uid, payload);
  }
}

export class FirebaseMockExamRepository
  extends FirebaseRepository<
    MockExamRecord,
    MockExamSubmitPayload,
    Partial<MockExamRecord>,
    RepositoryContext,
    { myExams: MockExamRecord[]; rankings: RankingEntry[] }
  >
  implements IMockExamRepository
{
  readonly entityName = 'mockExams';

  async findById(
    id: string,
    context?: RepositoryContext
  ): Promise<MockExamRecord | null> {
    const uid = this.resolveUid(context);
    const data = await this.getDocumentData(`users/${uid}/mockExams`, id);
    if (!data) return null;
    return {
      id,
      title: String(data.title || 'Simulado'),
      board: String(data.board || 'Todas'),
      career: String(data.career || 'Todas'),
      durationMinutes: Number(data.durationMinutes || 20),
      elapsedSeconds: Number(data.elapsedSeconds || 0),
      totalQuestions: Number(data.totalQuestions || 0),
      correctCount: Number(data.correctCount || 0),
      wrongCount: Number(data.wrongCount || 0),
      blankCount: Number(data.blankCount || 0),
      netScore: Number(data.netScore || 0),
      breakdownJson: Array.isArray(data.breakdownJson) ? data.breakdownJson : null,
      createdAt: toIsoString(data.createdAt),
    };
  }

  findAll(
    filters?: RepositoryContext,
    context?: RepositoryContext
  ): Promise<{ myExams: MockExamRecord[]; rankings: RankingEntry[] }> {
    return this.listAndRankings(this.resolveUid(context || filters));
  }

  async create(
    data: MockExamSubmitPayload,
    context?: RepositoryContext
  ): Promise<MockExamRecord> {
    const res = await this.submit(this.resolveUid(context), data);
    return res.exam;
  }

  async update(): Promise<MockExamRecord> {
    throw new Error(
      'Simulados finalizados são registros imutáveis nas regras do Firestore.'
    );
  }

  async delete(): Promise<void> {
    throw new Error(
      'Use o histórico da conta ou remoção direta autorizada para gerenciar simulados.'
    );
  }

  listAndRankings(uid: string) {
    return fetchMockExamsAndRankings(uid);
  }

  submit(
    uid: string,
    payload: MockExamSubmitPayload
  ): Promise<MockExamSubmitResult> {
    return submitMockExamToFirestore(uid, payload);
  }
}

export class FirebasePdfImportRepository
  extends FirebaseRepository<
    PdfImportHistory,
    PdfImportCommitPayload,
    Partial<PdfImportHistory>,
    RepositoryContext,
    PdfImportHistory[]
  >
  implements IPdfImportRepository
{
  readonly entityName = 'pdfImports';

  async findById(id: string): Promise<PdfImportHistory | null> {
    const data = await this.getDocumentData('pdfImports', id);
    if (!data) return null;
    return {
      id,
      title: String(data.title || 'Prova PDF'),
      fileName: String(data.fileName || 'prova.pdf'),
      board: String(data.board || 'FGV'),
      career: String(data.career || 'Tribunais'),
      year: Number(data.year || 2025),
      extractedCount: Number(data.extractedCount || 0),
      status: String(data.status || 'processed'),
      createdAt: toIsoString(data.createdAt),
    };
  }

  findAll(
    filters?: RepositoryContext,
    context?: RepositoryContext
  ): Promise<PdfImportHistory[]> {
    const uid = this.resolveUid(context || filters);
    const email =
      context?.email ?? filters?.email ?? this.firebaseAuth.currentUser?.email;
    return this.listImports(uid, email);
  }

  async create(
    data: PdfImportCommitPayload,
    context?: RepositoryContext
  ): Promise<PdfImportHistory> {
    const uid = this.resolveUid(context);
    const res = await this.commitExtracted(uid, data);
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
    throw new Error('Registros de importação PDF são imutáveis após processamento.');
  }

  delete(id: string): Promise<void> {
    return this.deleteImport(id);
  }

  listImports(uid: string, email?: string | null) {
    return fetchPdfImports(uid, email);
  }

  commitExtracted(uid: string, payload: PdfImportCommitPayload) {
    return commitPdfQuestionsToFirestore(uid, payload);
  }

  deleteImport(pdfId: string) {
    return deletePdfImportAndQuestions(pdfId);
  }
}

export class FirebaseRepositoryAdapter implements IAppRepositories {
  readonly driver = 'firebase' as const;
  readonly users: IUserRepository = new FirebaseUserRepository();
  readonly questions: IQuestionRepository = new FirebaseQuestionRepository();
  readonly pdfImports: IPdfImportRepository = new FirebasePdfImportRepository();
  readonly scraper: IScraperRepository = {
    listHistory: fetchScrapeHistory,
    saveScraped: saveScrapedQuestionsToFirestore,
  };
  readonly mockExams: IMockExamRepository = new FirebaseMockExamRepository();
  readonly dashboard: IDashboardRepository = {
    getAnalytics: fetchAnalyticsFromFirestore,
    listSchedules: fetchSchedules,
    createSchedule: createScheduleItem,
    updateSchedule: updateScheduleItem,
    deleteSchedule: deleteScheduleItem,
    exportBackup: exportUserBackupFromFirestore,
  };
  readonly community: ICommunityRepository = {
    listForumPosts: fetchForumPosts,
    createForumPost,
    replyForumPost,
    upvoteForumPost,
    listChatMessages: fetchChatHistory,
    saveChatMessage,
  };
}
