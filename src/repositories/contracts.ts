import type {
  AchievementBadge,
  AdminUserItem,
  ChatMessageItem,
  ForumPostItem,
  MockExamRecord,
  PdfImportHistory,
  QuestionItem,
  QuestionOption,
  RankingEntry,
  ScrapeJobHistory,
  StudyGoalProfile,
  StudyScheduleItem,
  SubjectStat,
  UserProfile,
  UserRole,
} from '../types';
import type { BaseRepository, RepositoryContext } from './BaseRepository';

export type { BaseRepository, RepositoryContext } from './BaseRepository';

export type DataDriver = 'firebase' | 'postgres';

export interface AuthSessionUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

export interface IAuthProvider {
  readonly mode: 'firebase' | 'local';
  readonly supportsGoogleWorkspace: boolean;
  initAuthListener(
    onAuthenticated: (user: AuthSessionUser) => void,
    onUnauthenticated: () => void
  ): () => void;
  signInWithGoogle(): Promise<{
    user: AuthSessionUser;
    workspaceToken: string | null;
  }>;
  signInWithPassword?(
    email: string,
    password: string
  ): Promise<AuthSessionUser>;
  registerWithPassword?(
    email: string,
    password: string,
    displayName: string
  ): Promise<AuthSessionUser>;
  getAccessToken(): Promise<string | null>;
  getWorkspaceAccessToken(): string | null;
  signOut(): Promise<void>;
}

export interface WorkspaceSyncResult {
  user: UserProfile;
  profiles: StudyGoalProfile[];
  achievements: AchievementBadge[];
  summary: {
    totalAttempts: number;
    correctAttempts: number;
    totalBankQuestions: number;
  };
}

export interface UserPreferencesUpdate {
  displayName?: string;
  preferredTheme?: 'light' | 'dark';
  dailyGoal?: number;
  pushEnabled?: boolean;
  planTier?: string;
}

export interface IUserRepository
  extends BaseRepository<
    UserProfile,
    AuthSessionUser,
    UserPreferencesUpdate,
    RepositoryContext,
    AdminUserItem[]
  > {
  syncWorkspace(authUser: AuthSessionUser): Promise<WorkspaceSyncResult>;
  updatePreferences(
    uid: string,
    updates: UserPreferencesUpdate
  ): Promise<UserProfile>;
  createStudyProfile(
    uid: string,
    payload: {
      name: string;
      career: string;
      targetBoard: string;
      examDate?: string | null;
      dailyHours?: number;
    }
  ): Promise<StudyGoalProfile>;
  activateStudyProfile(uid: string, profileId: string): Promise<void>;
  listAdminUsers(uid: string, email?: string | null): Promise<AdminUserItem[]>;
  updateUserRole(
    targetUid: string,
    nextRole: UserRole,
    currentAdminList: AdminUserItem[]
  ): Promise<AdminUserItem>;
}

export interface QuestionFilters {
  board?: string;
  career?: string;
  subject?: string;
  difficulty?: string;
  sourceType?: string;
  status?: string;
  search?: string;
  limitCount?: number;
}

export interface QuestionMutationPayload {
  board: string;
  career: string;
  subject: string;
  topic: string;
  organ: string;
  year: number;
  difficulty: string;
  questionType: 'multiple_choice' | 'true_false';
  statement: string;
  optionsJson: QuestionOption[];
  correctOption: string;
  commentary: string;
}

export interface IQuestionRepository
  extends BaseRepository<
    QuestionItem,
    QuestionMutationPayload,
    QuestionMutationPayload,
    QuestionFilters,
    { questions: QuestionItem[]; total: number }
  > {
  query(
    uid: string,
    filters: QuestionFilters
  ): Promise<{ questions: QuestionItem[]; total: number }>;
  fetchOfflinePack(): Promise<QuestionItem[]>;
  submitAttempt(
    uid: string,
    payload: {
      question: QuestionItem;
      selectedOption: string;
      timeSpentSec?: number;
      profileId?: string | null;
      isBookmarked?: boolean;
    }
  ): Promise<{
    isCorrect: boolean;
    correctOption: string;
    commentary: string;
    xpEarned: number;
    user: UserProfile | null;
  }>;
}

export interface PdfImportCommitPayload {
  title: string;
  fileName: string;
  board: string;
  career: string;
  year: number;
  items: {
    subject: string;
    topic: string;
    organ: string;
    difficulty: string;
    questionType: string;
    statement: string;
    options: QuestionOption[];
    correctOption: string;
    commentary: string;
  }[];
}

export interface IPdfImportRepository
  extends BaseRepository<
    PdfImportHistory,
    PdfImportCommitPayload,
    Partial<PdfImportHistory>,
    RepositoryContext,
    PdfImportHistory[]
  > {
  listImports(uid: string, email?: string | null): Promise<PdfImportHistory[]>;
  commitExtracted(
    uid: string,
    payload: PdfImportCommitPayload
  ): Promise<{ insertedCount: number; user: UserProfile | null }>;
  deleteImport(pdfId: string): Promise<void>;
}

export interface IScraperRepository {
  listHistory(uid: string, email?: string | null): Promise<ScrapeJobHistory[]>;
  saveScraped(
    uid: string,
    payload: {
      sourceName: string;
      sourceUrl: string;
      board: string;
      career: string;
      summary: string;
      questions: {
        subject: string;
        topic: string;
        organ: string;
        difficulty: string;
        questionType: 'multiple_choice' | 'true_false';
        statement: string;
        options: QuestionOption[];
        correctOption: string;
        commentary: string;
      }[];
    }
  ): Promise<{
    insertedCount: number;
    questions: QuestionItem[];
    job: ScrapeJobHistory;
  }>;
}

export interface MockExamSubmitPayload {
  title: string;
  board: string;
  career: string;
  durationMinutes: number;
  elapsedSeconds: number;
  cebraspePenalty: boolean;
  questions: QuestionItem[];
  answers: Record<string, string>;
}

export interface MockExamSubmitResult {
  exam: MockExamRecord;
  detailedResults: {
    questionId: string;
    subject: string;
    statement: string;
    selectedOption: string | null;
    correctOption: string;
    isCorrect: boolean;
    commentary: string;
  }[];
  user: UserProfile | null;
}

export interface IMockExamRepository
  extends BaseRepository<
    MockExamRecord,
    MockExamSubmitPayload,
    Partial<MockExamRecord>,
    RepositoryContext,
    { myExams: MockExamRecord[]; rankings: RankingEntry[] }
  > {
  listAndRankings(uid: string): Promise<{
    myExams: MockExamRecord[];
    rankings: RankingEntry[];
  }>;
  submit(
    uid: string,
    payload: MockExamSubmitPayload
  ): Promise<MockExamSubmitResult>;
}

export interface IDashboardRepository {
  getAnalytics(uid: string): Promise<{
    subjectStats: SubjectStat[];
    recentErrors: { subject: string; topic: string; board: string }[];
  }>;
  listSchedules(uid: string): Promise<StudyScheduleItem[]>;
  createSchedule(
    uid: string,
    payload: {
      dayOfWeek: number;
      startTime: string;
      durationMinutes: number;
      subject: string;
      focusType: string;
    }
  ): Promise<StudyScheduleItem>;
  updateSchedule(
    uid: string,
    scheduleId: string,
    updates: { completed?: boolean; calendarEventId?: string }
  ): Promise<StudyScheduleItem>;
  deleteSchedule(uid: string, scheduleId: string): Promise<void>;
  exportBackup(user: UserProfile): Promise<unknown>;
}

export interface ICommunityRepository {
  listForumPosts(): Promise<ForumPostItem[]>;
  createForumPost(
    user: UserProfile,
    payload: {
      title: string;
      body: string;
      subject: string;
      questionId?: string | null;
    }
  ): Promise<ForumPostItem>;
  replyForumPost(
    postId: string,
    user: UserProfile,
    text: string
  ): Promise<ForumPostItem>;
  upvoteForumPost(postId: string): Promise<ForumPostItem>;
  listChatMessages(room: string): Promise<ChatMessageItem[]>;
  saveChatMessage(
    user: UserProfile,
    room: string,
    message: string
  ): Promise<ChatMessageItem>;
}

export interface IAppRepositories {
  readonly driver: DataDriver;
  readonly users: IUserRepository;
  readonly questions: IQuestionRepository;
  readonly pdfImports: IPdfImportRepository;
  readonly scraper: IScraperRepository;
  readonly mockExams: IMockExamRepository;
  readonly dashboard: IDashboardRepository;
  readonly community: ICommunityRepository;
}
