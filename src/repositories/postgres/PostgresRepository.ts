import { apiFetch } from '../../lib/api';
import type {
  AdminUserItem,
  ChatMessageItem,
  ForumPostItem,
  MockExamRecord,
  PdfImportHistory,
  QuestionItem,
  RankingEntry,
  ScrapeJobHistory,
  StudyGoalProfile,
  StudyScheduleItem,
  SubjectStat,
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
  WorkspaceSyncResult,
} from '../contracts';

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

  protected request<T>(path: string, options?: RequestInit): Promise<T> {
    return apiFetch<T>(path, options);
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

export class PostgresUserRepository
  extends PostgresRepository<
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
    const res = await this.request<{ user: UserProfile | null }>(
      `/api/v1/me?uid=${encodeURIComponent(id)}`
    );
    return res.user;
  }

  findAll(): Promise<AdminUserItem[]> {
    return this.listAdminUsers();
  }

  async create(data: AuthSessionUser): Promise<UserProfile> {
    const res = await this.syncWorkspace(data);
    return res.user;
  }

  update(id: string, data: UserPreferencesUpdate): Promise<UserProfile> {
    return this.updatePreferences(id, data);
  }

  async delete(): Promise<void> {
    throw new Error('Exclusão direta de conta de usuário não permitida.');
  }

  syncWorkspace(_authUser: AuthSessionUser): Promise<WorkspaceSyncResult> {
    return this.request<WorkspaceSyncResult>('/api/v1/workspace/sync', {
      method: 'POST',
    });
  }

  async updatePreferences(
    _uid: string,
    updates: UserPreferencesUpdate
  ): Promise<UserProfile> {
    const res = await this.request<{ user: UserProfile }>(
      '/api/v1/me/preferences',
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
    return res.user;
  }

  async createStudyProfile(
    _uid: string,
    payload: {
      name: string;
      career: string;
      targetBoard: string;
      examDate?: string | null;
      dailyHours?: number;
    }
  ): Promise<StudyGoalProfile> {
    const res = await this.request<{ profile: StudyGoalProfile }>(
      '/api/v1/me/profiles',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return res.profile;
  }

  async activateStudyProfile(_uid: string, profileId: string): Promise<void> {
    await this.request(
      `/api/v1/me/profiles/${encodeURIComponent(profileId)}/activate`,
      { method: 'POST' }
    );
  }

  async listAdminUsers(): Promise<AdminUserItem[]> {
    const res = await this.request<{ users: AdminUserItem[] }>(
      '/api/v1/admin/users'
    );
    return res.users;
  }

  async updateUserRole(
    targetUid: string,
    nextRole: UserRole
  ): Promise<AdminUserItem> {
    const res = await this.request<{ user: AdminUserItem }>(
      `/api/v1/admin/users/${encodeURIComponent(targetUid)}/role`,
      {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      }
    );
    return res.user;
  }
}

export class PostgresQuestionRepository
  extends PostgresRepository<
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
    const res = await this.request<{ question: QuestionItem | null }>(
      `/api/v1/questions/${encodeURIComponent(id)}`
    );
    return res.question;
  }

  findAll(
    filters: QuestionFilters = {},
    context?: RepositoryContext
  ): Promise<{ questions: QuestionItem[]; total: number }> {
    return this.query(context?.uid || '', filters);
  }

  async create(payload: QuestionMutationPayload): Promise<QuestionItem> {
    const res = await this.request<{ question: QuestionItem }>(
      '/api/v1/questions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return res.question;
  }

  async update(
    questionId: string,
    payload: QuestionMutationPayload
  ): Promise<QuestionItem> {
    const res = await this.request<{ question: QuestionItem }>(
      `/api/v1/questions/${encodeURIComponent(questionId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return res.question;
  }

  async delete(questionId: string): Promise<void> {
    await this.request(`/api/v1/questions/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    });
  }

  query(
    _uid: string,
    filters: QuestionFilters
  ): Promise<{ questions: QuestionItem[]; total: number }> {
    const params = new URLSearchParams();
    if (filters.board) params.set('board', filters.board);
    if (filters.career) params.set('career', filters.career);
    if (filters.subject) params.set('subject', filters.subject);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    if (filters.sourceType) params.set('sourceType', filters.sourceType);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.limitCount) params.set('limit', String(filters.limitCount));
    return this.request<{ questions: QuestionItem[]; total: number }>(
      `/api/v1/questions?${params.toString()}`
    );
  }

  async fetchOfflinePack(): Promise<QuestionItem[]> {
    const res = await this.request<{ questions: QuestionItem[] }>(
      '/api/v1/questions/offline-pack'
    );
    return res.questions;
  }

  submitAttempt(
    _uid: string,
    payload: {
      question: QuestionItem;
      selectedOption: string;
      timeSpentSec?: number;
      profileId?: string | null;
      isBookmarked?: boolean;
    }
  ) {
    return this.request<{
      isCorrect: boolean;
      correctOption: string;
      commentary: string;
      xpEarned: number;
      user: UserProfile | null;
    }>(`/api/v1/questions/${encodeURIComponent(payload.question.id)}/attempt`, {
      method: 'POST',
      body: JSON.stringify({
        selectedOption: payload.selectedOption,
        timeSpentSec: payload.timeSpentSec,
        profileId: payload.profileId,
        isBookmarked: payload.isBookmarked,
      }),
    });
  }
}

export class PostgresMockExamRepository
  extends PostgresRepository<
    MockExamRecord,
    MockExamSubmitPayload,
    Partial<MockExamRecord>,
    RepositoryContext,
    { myExams: MockExamRecord[]; rankings: RankingEntry[] }
  >
  implements IMockExamRepository
{
  readonly entityName = 'mock_exams';

  async findById(id: string): Promise<MockExamRecord | null> {
    const res = await this.request<{ exam: MockExamRecord | null }>(
      `/api/v1/mock-exams/${encodeURIComponent(id)}`
    );
    return res.exam;
  }

  findAll(): Promise<{ myExams: MockExamRecord[]; rankings: RankingEntry[] }> {
    return this.listAndRankings();
  }

  async create(
    data: MockExamSubmitPayload,
    context?: RepositoryContext
  ): Promise<MockExamRecord> {
    const res = await this.submit(context?.uid || '', data);
    return res.exam;
  }

  async update(): Promise<MockExamRecord> {
    throw new Error('Simulados finalizados são registros imutáveis.');
  }

  async delete(): Promise<void> {
    throw new Error('Exclusão de simulados finalizados não permitida.');
  }

  listAndRankings(): Promise<{
    myExams: MockExamRecord[];
    rankings: RankingEntry[];
  }> {
    return this.request<{
      myExams: MockExamRecord[];
      rankings: RankingEntry[];
    }>('/api/v1/mock-exams');
  }

  submit(
    _uid: string,
    payload: MockExamSubmitPayload
  ): Promise<MockExamSubmitResult> {
    return this.request<MockExamSubmitResult>('/api/v1/mock-exams/submit', {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        board: payload.board,
        career: payload.career,
        durationMinutes: payload.durationMinutes,
        elapsedSeconds: payload.elapsedSeconds,
        cebraspePenalty: payload.cebraspePenalty,
        questionIds: payload.questions.map((q) => q.id),
        answers: payload.answers,
      }),
    });
  }
}

export class PostgresPdfImportRepository
  extends PostgresRepository<
    PdfImportHistory,
    PdfImportCommitPayload,
    Partial<PdfImportHistory>,
    RepositoryContext,
    PdfImportHistory[]
  >
  implements IPdfImportRepository
{
  readonly entityName = 'pdf_imports';

  async findById(id: string): Promise<PdfImportHistory | null> {
    const res = await this.request<{ pdfImport: PdfImportHistory | null }>(
      `/api/v1/pdfs/${encodeURIComponent(id)}`
    );
    return res.pdfImport;
  }

  findAll(): Promise<PdfImportHistory[]> {
    return this.listImports();
  }

  async create(
    data: PdfImportCommitPayload,
    context?: RepositoryContext
  ): Promise<PdfImportHistory> {
    const res = await this.commitExtracted(context?.uid || '', data);
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
    return this.deleteImport(id);
  }

  async listImports(): Promise<PdfImportHistory[]> {
    const res = await this.request<{ imports: PdfImportHistory[] }>(
      '/api/v1/pdfs/history'
    );
    return res.imports;
  }

  commitExtracted(
    _uid: string,
    payload: PdfImportCommitPayload
  ): Promise<{ insertedCount: number; user: UserProfile | null }> {
    return this.request<{ insertedCount: number; user: UserProfile | null }>(
      '/api/v1/pdfs/commit',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  async deleteImport(pdfId: string): Promise<void> {
    await this.request(`/api/v1/pdfs/${encodeURIComponent(pdfId)}`, {
      method: 'DELETE',
    });
  }
}

export class PostgresRepositoryAdapter implements IAppRepositories {
  readonly driver = 'postgres' as const;
  readonly users: IUserRepository = new PostgresUserRepository();
  readonly questions: IQuestionRepository = new PostgresQuestionRepository();
  readonly pdfImports: IPdfImportRepository = new PostgresPdfImportRepository();
  readonly scraper: IScraperRepository = {
    async listHistory() {
      const res = await apiFetch<{ jobs: ScrapeJobHistory[] }>(
        '/api/v1/scraper/history'
      );
      return res.jobs;
    },
    async saveScraped(_uid: string, payload) {
      return apiFetch<{
        insertedCount: number;
        questions: QuestionItem[];
        job: ScrapeJobHistory;
      }>('/api/v1/scraper/commit', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  };
  readonly mockExams: IMockExamRepository = new PostgresMockExamRepository();
  readonly dashboard: IDashboardRepository = {
    async getAnalytics() {
      return apiFetch<{
        subjectStats: SubjectStat[];
        recentErrors: { subject: string; topic: string; board: string }[];
      }>('/api/v1/analytics');
    },
    async listSchedules() {
      const res = await apiFetch<{ schedules: StudyScheduleItem[] }>(
        '/api/v1/schedules'
      );
      return res.schedules;
    },
    async createSchedule(_uid: string, payload) {
      const res = await apiFetch<{ schedule: StudyScheduleItem }>(
        '/api/v1/schedules',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      return res.schedule;
    },
    async updateSchedule(_uid: string, scheduleId: string, updates) {
      const res = await apiFetch<{ schedule: StudyScheduleItem }>(
        `/api/v1/schedules/${encodeURIComponent(scheduleId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );
      return res.schedule;
    },
    async deleteSchedule(_uid: string, scheduleId: string) {
      await apiFetch(`/api/v1/schedules/${encodeURIComponent(scheduleId)}`, {
        method: 'DELETE',
      });
    },
    async exportBackup() {
      return apiFetch('/api/v1/backup/export');
    },
  };
  readonly community: ICommunityRepository = {
    async listForumPosts() {
      const res = await apiFetch<{ posts: ForumPostItem[] }>('/api/v1/forum');
      return res.posts;
    },
    async createForumPost(user: UserProfile, payload) {
      const res = await apiFetch<{ post: ForumPostItem }>('/api/v1/forum', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          authorName: user.displayName || user.email.split('@')[0],
        }),
      });
      return res.post;
    },
    async replyForumPost(postId: string, user: UserProfile, text: string) {
      const res = await apiFetch<{ post: ForumPostItem }>(
        `/api/v1/forum/${encodeURIComponent(postId)}/reply`,
        {
          method: 'POST',
          body: JSON.stringify({
            text,
            authorName: user.displayName || user.email.split('@')[0],
          }),
        }
      );
      return res.post;
    },
    async upvoteForumPost(postId: string) {
      const res = await apiFetch<{ post: ForumPostItem }>(
        `/api/v1/forum/${encodeURIComponent(postId)}/upvote`,
        { method: 'POST' }
      );
      return res.post;
    },
    async listChatMessages(room: string) {
      const res = await apiFetch<{ messages: ChatMessageItem[] }>(
        `/api/v1/chat/${encodeURIComponent(room)}`
      );
      return res.messages;
    },
    async saveChatMessage(user: UserProfile, room: string, message: string) {
      const res = await apiFetch<{ message: ChatMessageItem }>(
        `/api/v1/chat/${encodeURIComponent(room)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            message,
            authorName: user.displayName || user.email.split('@')[0],
            authorLevel: user.level,
          }),
        }
      );
      return res.message;
    },
  };
}
