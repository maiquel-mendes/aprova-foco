export interface QuestionOption {
  key: string;
  text: string;
}

export interface QuestionItem {
  id: string;
  code: string;
  board: string;
  career: string;
  subject: string;
  topic: string;
  organ: string;
  year: number;
  difficulty: 'Fácil' | 'Média' | 'Difícil' | string;
  questionType: 'multiple_choice' | 'true_false' | string;
  statement: string;
  optionsJson: QuestionOption[];
  correctOption: string;
  commentary: string;
  sourceType: 'curated' | 'pdf_import' | 'portal_scrape' | string;
  pdfImportId?: string;
  createdByUserId?: string;
  createdAt?: string;
  userAttempt?: {
    selectedOption: string;
    isCorrect: boolean;
    isBookmarked: boolean;
  } | null;
}

export type UserRole = 'admin' | 'editor' | 'user';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  xp: number;
  level: number;
  streakDays: number;
  lastStudyDate: string | null;
  planTier: string;
  dailyGoal: number;
  pushEnabled: boolean;
  preferredTheme: 'light' | 'dark' | string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  xp: number;
  level: number;
  streakDays: number;
  createdAt: string | null;
}

export interface StudyGoalProfile {
  id: string;
  userId: string;
  name: string;
  career: string;
  targetBoard: string;
  examDate: string | null;
  dailyHours: number;
  isActive: boolean;
}

export interface AchievementBadge {
  id: string;
  badgeKey: string;
  title: string;
  description: string;
  unlockedAt: string;
}

export interface PdfImportHistory {
  id: string;
  title: string;
  fileName: string;
  board: string;
  career: string;
  year: number;
  extractedCount: number;
  status: string;
  createdAt: string;
}

export interface ScrapeSourcePreset {
  id: string;
  name: string;
  board: string;
  career: string;
  url: string;
  description: string;
}

export interface ScrapeJobHistory {
  id: string;
  sourceName: string;
  sourceUrl: string;
  board: string;
  career: string;
  questionsImported: number;
  status: string;
  summary: string | null;
  ranAt: string;
}

export interface MockExamRecord {
  id: string;
  title: string;
  board: string;
  career: string;
  durationMinutes: number;
  elapsedSeconds: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  netScore: number;
  breakdownJson: { subject: string; total: number; correct: number }[] | null;
  createdAt: string;
}

export interface RankingEntry {
  userId: string;
  displayName: string | null;
  xp: number;
  level: number;
  streakDays: number;
  bestScore: number;
  examsCount: number;
}

export interface SubjectStat {
  subject: string;
  total: number;
  correct: number;
  avgSeconds: number;
}

export interface AdaptiveDiagnosis {
  summary: string;
  readinessScore: number;
  weakTopics: {
    subject: string;
    topic: string;
    accuracy: number;
    priority: 'Alta' | 'Média' | 'Monitorar' | string;
    recommendation: string;
  }[];
  recommendedBlocks: {
    subject: string;
    focusType: 'Questões' | 'Revisão IA' | 'Simulado' | 'Teoria PDF' | string;
    durationMinutes: number;
    reason: string;
  }[];
}

export interface StudyScheduleItem {
  id: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  subject: string;
  focusType: string;
  completed: boolean;
  calendarEventId: string | null;
}

export interface ForumPostItem {
  id: string;
  questionId: string | null;
  subject: string;
  title: string;
  body: string;
  authorName: string;
  upvotes: number;
  repliesJson: {
    id: string;
    author: string;
    text: string;
    createdAt: string;
  }[];
  createdAt: string;
}

export interface ChatMessageItem {
  id: string;
  room: string;
  authorName: string;
  authorLevel: number;
  message: string;
  createdAt: string;
}
