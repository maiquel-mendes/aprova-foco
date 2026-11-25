import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
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
} from '../../types.ts';
import { getPgDb } from '../db/client.ts';
import {
  achievementsTable,
  chatMessagesTable,
  forumPostsTable,
  mockExamsTable,
  pdfImportsTable,
  questionAttemptsTable,
  questionsTable,
  scrapeJobsTable,
  studyProfilesTable,
  studySchedulesTable,
  usersTable,
} from '../db/schema.ts';
import { ensurePostgresSeeded } from '../db/seed.ts';

function clampStr(
  val: unknown,
  fallback: string,
  min: number,
  max: number
): string {
  const s = String(val ?? '').trim();
  const base = s.length >= min ? s : fallback;
  return base.slice(0, max);
}

function mapUser(row: typeof usersTable.$inferSelect): UserProfile {
  return {
    id: row.id,
    uid: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    role: (row.role as UserRole) || 'user',
    xp: row.xp,
    level: row.level,
    streakDays: row.streakDays,
    lastStudyDate: row.lastStudyDate,
    planTier: row.planTier,
    dailyGoal: row.dailyGoal,
    pushEnabled: row.pushEnabled,
    preferredTheme: row.preferredTheme === 'dark' ? 'dark' : 'light',
  };
}

function mapQuestion(
  row: typeof questionsTable.$inferSelect,
  attempt?: {
    selectedOption: string;
    isCorrect: boolean;
    isBookmarked: boolean;
  } | null
): QuestionItem {
  return {
    id: row.id,
    code: row.code,
    board: row.board,
    career: row.career,
    subject: row.subject,
    topic: row.topic,
    organ: row.organ,
    year: row.year,
    difficulty: row.difficulty,
    questionType: row.questionType,
    statement: row.statement,
    optionsJson: Array.isArray(row.optionsJson) ? row.optionsJson : [],
    correctOption: row.correctOption,
    commentary: row.commentary,
    sourceType: row.sourceType,
    pdfImportId: row.pdfImportId ?? undefined,
    createdByUserId: row.createdByUserId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    userAttempt: attempt ?? null,
  };
}

async function awardAchievementIfMissing(
  userId: string,
  badgeKey: string,
  title: string,
  description: string
) {
  const db = getPgDb();
  await db
    .insert(achievementsTable)
    .values({
      userId,
      badgeKey,
      title: clampStr(title, 'Conquista', 2, 120),
      description: clampStr(description, 'Marco alcançado.', 2, 240),
    })
    .onConflictDoNothing({
      target: [achievementsTable.userId, achievementsTable.badgeKey],
    });
}

async function addXpAndCheckStreak(
  userId: string,
  xpDelta: number
): Promise<UserProfile | null> {
  const db = getPgDb();
  const [current] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!current) return null;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let nextStreak = current.streakDays || 1;
  if (current.lastStudyDate === yesterday) {
    nextStreak += 1;
  } else if (current.lastStudyDate !== today) {
    nextStreak = Math.max(1, nextStreak);
  }

  const nextXp = (current.xp || 0) + xpDelta;
  const nextLevel = Math.floor(nextXp / 250) + 1;

  const [updated] = await db
    .update(usersTable)
    .set({
      xp: nextXp,
      level: nextLevel,
      streakDays: nextStreak,
      lastStudyDate: today,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId))
    .returning();

  if (nextStreak >= 3) {
    await awardAchievementIfMissing(
      userId,
      'streak_3',
      'Constância Inabalável',
      'Manteve 3 dias consecutivos de prática no edital.'
    );
  }

  return updated ? mapUser(updated) : null;
}

export async function initStarterWorkspaceForUser(userId: string): Promise<void> {
  const db = getPgDb();
  const existingProfiles = await db
    .select({ id: studyProfilesTable.id })
    .from(studyProfilesTable)
    .where(eq(studyProfilesTable.userId, userId))
    .limit(1);

  if (existingProfiles.length === 0) {
    await db.insert(studyProfilesTable).values([
      {
        userId,
        name: 'Tribunais — Analista Judiciário',
        career: 'Tribunais',
        targetBoard: 'FGV',
        dailyHours: 4,
        isActive: true,
      },
      {
        userId,
        name: 'Receita & Fiscos Estaduais',
        career: 'Fiscal',
        targetBoard: 'Cebraspe',
        dailyHours: 3,
        isActive: false,
      },
    ]);
  }

  const existingSchedules = await db
    .select({ id: studySchedulesTable.id })
    .from(studySchedulesTable)
    .where(eq(studySchedulesTable.userId, userId))
    .limit(1);

  if (existingSchedules.length === 0) {
    await db.insert(studySchedulesTable).values([
      {
        userId,
        dayOfWeek: 1,
        startTime: '19:00',
        durationMinutes: 90,
        subject: 'Direito Constitucional',
        focusType: 'Questões',
      },
      {
        userId,
        dayOfWeek: 2,
        startTime: '19:00',
        durationMinutes: 90,
        subject: 'Direito Administrativo',
        focusType: 'Teoria PDF',
      },
      {
        userId,
        dayOfWeek: 3,
        startTime: '19:00',
        durationMinutes: 90,
        subject: 'Língua Portuguesa',
        focusType: 'Questões',
      },
      {
        userId,
        dayOfWeek: 4,
        startTime: '19:00',
        durationMinutes: 90,
        subject: 'Raciocínio Lógico',
        focusType: 'Revisão IA',
      },
      {
        userId,
        dayOfWeek: 5,
        startTime: '19:00',
        durationMinutes: 90,
        subject: 'Direito Tributário',
        focusType: 'Questões',
      },
      {
        userId,
        dayOfWeek: 6,
        startTime: '09:00',
        durationMinutes: 120,
        subject: 'Simulado Semanal',
        focusType: 'Simulado',
      },
    ]);
  }
}

export async function pgSyncWorkspace(userId: string): Promise<{
  user: UserProfile;
  profiles: StudyGoalProfile[];
  achievements: AchievementBadge[];
  summary: {
    totalAttempts: number;
    correctAttempts: number;
    totalBankQuestions: number;
  };
}> {
  const db = getPgDb();
  const [userRow] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!userRow) {
    throw new Error('Usuário não encontrado.');
  }

  await ensurePostgresSeeded(
    userRow.role === 'admin' ? userRow.id : undefined
  );
  await initStarterWorkspaceForUser(userRow.id);

  const [profRows, achRows, attSummary, qCountRow] = await Promise.all([
    db
      .select()
      .from(studyProfilesTable)
      .where(eq(studyProfilesTable.userId, userId))
      .orderBy(desc(studyProfilesTable.isActive)),
    db
      .select()
      .from(achievementsTable)
      .where(eq(achievementsTable.userId, userId))
      .orderBy(desc(achievementsTable.unlockedAt)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        correct: sql<number>`coalesce(sum(case when ${questionAttemptsTable.isCorrect} then 1 else 0 end), 0)::int`,
      })
      .from(questionAttemptsTable)
      .where(eq(questionAttemptsTable.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(questionsTable),
  ]);

  return {
    user: mapUser(userRow),
    profiles: profRows.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      career: p.career,
      targetBoard: p.targetBoard,
      examDate: p.examDate,
      dailyHours: p.dailyHours,
      isActive: p.isActive,
    })),
    achievements: achRows.map((a) => ({
      id: a.id,
      badgeKey: a.badgeKey,
      title: a.title,
      description: a.description,
      unlockedAt: a.unlockedAt.toISOString(),
    })),
    summary: {
      totalAttempts: attSummary[0]?.total ?? 0,
      correctAttempts: attSummary[0]?.correct ?? 0,
      totalBankQuestions: qCountRow[0]?.count ?? 0,
    },
  };
}

export async function pgUpdatePreferences(
  userId: string,
  updates: {
    displayName?: string;
    preferredTheme?: 'light' | 'dark';
    dailyGoal?: number;
    pushEnabled?: boolean;
    planTier?: string;
  }
): Promise<UserProfile> {
  const db = getPgDb();
  const patch: Partial<typeof usersTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (typeof updates.displayName === 'string') {
    const cleaned = updates.displayName.trim();
    if (cleaned.length < 2 || cleaned.length > 60) {
      throw new Error('O nome de exibição deve ter entre 2 e 60 caracteres.');
    }
    patch.displayName = cleaned;
  }
  if (updates.preferredTheme === 'light' || updates.preferredTheme === 'dark') {
    patch.preferredTheme = updates.preferredTheme;
  }
  if (typeof updates.dailyGoal === 'number') {
    patch.dailyGoal = Math.max(5, Math.min(200, Math.round(updates.dailyGoal)));
  }
  if (typeof updates.pushEnabled === 'boolean') {
    patch.pushEnabled = updates.pushEnabled;
  }
  if (
    updates.planTier === 'free' ||
    updates.planTier === 'premium_monthly' ||
    updates.planTier === 'premium_trial'
  ) {
    patch.planTier = updates.planTier;
  }

  const [updated] = await db
    .update(usersTable)
    .set(patch)
    .where(eq(usersTable.id, userId))
    .returning();
  if (!updated) throw new Error('Usuário não encontrado.');
  return mapUser(updated);
}

export async function pgCreateStudyProfile(
  userId: string,
  payload: {
    name: string;
    career: string;
    targetBoard: string;
    examDate?: string | null;
    dailyHours?: number;
  }
): Promise<StudyGoalProfile> {
  const db = getPgDb();
  await db
    .update(studyProfilesTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(studyProfilesTable.userId, userId));

  const [created] = await db
    .insert(studyProfilesTable)
    .values({
      userId,
      name: clampStr(payload.name, 'Novo Edital', 2, 100),
      career: clampStr(payload.career, 'Tribunais', 2, 60),
      targetBoard: clampStr(payload.targetBoard, 'FGV', 2, 40),
      examDate: payload.examDate
        ? String(payload.examDate).trim().slice(0, 30)
        : null,
      dailyHours: Math.max(1, Math.min(18, Number(payload.dailyHours) || 3)),
      isActive: true,
    })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    name: created.name,
    career: created.career,
    targetBoard: created.targetBoard,
    examDate: created.examDate,
    dailyHours: created.dailyHours,
    isActive: created.isActive,
  };
}

export async function pgActivateStudyProfile(
  userId: string,
  profileId: string
): Promise<void> {
  const db = getPgDb();
  await db
    .update(studyProfilesTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(studyProfilesTable.userId, userId));
  await db
    .update(studyProfilesTable)
    .set({ isActive: true, updatedAt: new Date() })
    .where(
      and(
        eq(studyProfilesTable.id, profileId),
        eq(studyProfilesTable.userId, userId)
      )
    );
}

export async function pgListAdminUsers(): Promise<AdminUserItem[]> {
  const db = getPgDb();
  const rows = await db
    .select()
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    role: (r.role as UserRole) || 'user',
    xp: r.xp,
    level: r.level,
    streakDays: r.streakDays,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function pgUpdateUserRole(
  targetUid: string,
  nextRole: UserRole
): Promise<AdminUserItem> {
  const db = getPgDb();
  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, targetUid))
    .limit(1);
  if (!target) throw new Error('Usuário não encontrado.');

  if (target.role === 'admin' && nextRole !== 'admin') {
    const [{ adminCount }] = await db
      .select({ adminCount: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, 'admin'));
    if (adminCount <= 1) {
      throw new Error(
        'Não é possível remover o último administrador ativo do sistema.'
      );
    }
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role: nextRole, updatedAt: new Date() })
    .where(eq(usersTable.id, targetUid))
    .returning();

  return {
    id: updated.id,
    email: updated.email,
    displayName: updated.displayName,
    role: (updated.role as UserRole) || nextRole,
    xp: updated.xp,
    level: updated.level,
    streakDays: updated.streakDays,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function pgQueryQuestions(
  userId: string,
  filters: {
    board?: string;
    career?: string;
    subject?: string;
    difficulty?: string;
    sourceType?: string;
    status?: string;
    search?: string;
    limitCount?: number;
  }
): Promise<{ questions: QuestionItem[]; total: number }> {
  const db = getPgDb();
  const conditions = [];

  if (filters.board && filters.board !== 'Todas') {
    conditions.push(eq(questionsTable.board, filters.board));
  }
  if (filters.career && filters.career !== 'Todas') {
    conditions.push(eq(questionsTable.career, filters.career));
  }
  if (filters.subject && filters.subject !== 'Todas') {
    conditions.push(eq(questionsTable.subject, filters.subject));
  }
  if (filters.difficulty && filters.difficulty !== 'Todas') {
    conditions.push(eq(questionsTable.difficulty, filters.difficulty));
  }
  if (filters.sourceType && filters.sourceType !== 'Todos') {
    conditions.push(eq(questionsTable.sourceType, filters.sourceType));
  }
  if (filters.search && filters.search.trim()) {
    const pattern = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(questionsTable.statement, pattern),
        ilike(questionsTable.topic, pattern),
        ilike(questionsTable.organ, pattern),
        ilike(questionsTable.code, pattern)
      )!
    );
  }

  const [qRows, attRows] = await Promise.all([
    conditions.length > 0
      ? db
          .select()
          .from(questionsTable)
          .where(and(...conditions))
          .orderBy(desc(questionsTable.createdAt))
      : db.select().from(questionsTable).orderBy(desc(questionsTable.createdAt)),
    db
      .select()
      .from(questionAttemptsTable)
      .where(eq(questionAttemptsTable.userId, userId))
      .orderBy(desc(questionAttemptsTable.createdAt)),
  ]);

  const attemptMap = new Map<
    string,
    { selectedOption: string; isCorrect: boolean; isBookmarked: boolean }
  >();
  for (const att of attRows) {
    if (!attemptMap.has(att.questionId)) {
      attemptMap.set(att.questionId, {
        selectedOption: att.selectedOption,
        isCorrect: att.isCorrect,
        isBookmarked: att.isBookmarked,
      });
    }
  }

  let items = qRows.map((q) => mapQuestion(q, attemptMap.get(q.id) || null));

  if (filters.status === 'unanswered') {
    items = items.filter((q) => !q.userAttempt);
  } else if (filters.status === 'wrong') {
    items = items.filter((q) => q.userAttempt && !q.userAttempt.isCorrect);
  } else if (filters.status === 'correct') {
    items = items.filter((q) => q.userAttempt && q.userAttempt.isCorrect);
  } else if (filters.status === 'bookmarked') {
    items = items.filter((q) => q.userAttempt?.isBookmarked);
  }

  const total = items.length;
  return {
    questions: items.slice(0, filters.limitCount || 40),
    total,
  };
}

export async function pgFetchOfflinePack(): Promise<QuestionItem[]> {
  const db = getPgDb();
  const rows = await db
    .select()
    .from(questionsTable)
    .orderBy(desc(questionsTable.createdAt))
    .limit(100);
  return rows.map((r) => mapQuestion(r, null));
}

export async function pgCreateManualQuestion(
  userId: string,
  payload: {
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
): Promise<QuestionItem> {
  const db = getPgDb();
  const cleanBoard = clampStr(payload.board, 'FGV', 2, 40);
  const stamp = Date.now().toString().slice(-6);
  const code = `MAN-${cleanBoard.slice(0, 3).toUpperCase()}-${stamp}`;

  const [created] = await db
    .insert(questionsTable)
    .values({
      code,
      board: cleanBoard,
      career: clampStr(payload.career, 'Tribunais', 2, 60),
      subject: clampStr(payload.subject, 'Direito Constitucional', 2, 80),
      topic: clampStr(payload.topic, 'Tópico Geral', 2, 140),
      organ: clampStr(payload.organ, 'Órgão Público', 2, 100),
      year: Math.max(
        1990,
        Math.min(2035, Math.round(Number(payload.year) || 2025))
      ),
      difficulty:
        payload.difficulty === 'Fácil' || payload.difficulty === 'Difícil'
          ? payload.difficulty
          : 'Média',
      questionType:
        payload.questionType === 'true_false' ? 'true_false' : 'multiple_choice',
      statement: clampStr(payload.statement, 'Enunciado da questão.', 10, 5000),
      optionsJson: payload.optionsJson.slice(0, 5),
      correctOption: clampStr(payload.correctOption.toUpperCase(), 'A', 1, 5),
      commentary: clampStr(
        payload.commentary,
        'Comentário cadastrado pela equipe editorial.',
        5,
        5000
      ),
      sourceType: 'curated',
      createdByUserId: userId,
    })
    .returning();

  return mapQuestion(created, null);
}

export async function pgUpdateQuestion(
  questionId: string,
  payload: {
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
): Promise<QuestionItem> {
  const db = getPgDb();
  const [updated] = await db
    .update(questionsTable)
    .set({
      board: clampStr(payload.board, 'FGV', 2, 40),
      career: clampStr(payload.career, 'Tribunais', 2, 60),
      subject: clampStr(payload.subject, 'Direito Constitucional', 2, 80),
      topic: clampStr(payload.topic, 'Tópico Geral', 2, 140),
      organ: clampStr(payload.organ, 'Órgão Público', 2, 100),
      year: Math.max(
        1990,
        Math.min(2035, Math.round(Number(payload.year) || 2025))
      ),
      difficulty:
        payload.difficulty === 'Fácil' || payload.difficulty === 'Difícil'
          ? payload.difficulty
          : 'Média',
      questionType:
        payload.questionType === 'true_false' ? 'true_false' : 'multiple_choice',
      statement: clampStr(payload.statement, 'Enunciado da questão.', 10, 5000),
      optionsJson: payload.optionsJson.slice(0, 5),
      correctOption: clampStr(payload.correctOption.toUpperCase(), 'A', 1, 5),
      commentary: clampStr(
        payload.commentary,
        'Comentário cadastrado pela equipe editorial.',
        5,
        5000
      ),
      updatedAt: new Date(),
    })
    .where(eq(questionsTable.id, questionId))
    .returning();

  if (!updated) throw new Error('Questão não encontrada.');
  return mapQuestion(updated, null);
}

export async function pgDeleteQuestion(questionId: string): Promise<void> {
  const db = getPgDb();
  await db.delete(questionsTable).where(eq(questionsTable.id, questionId));
}

export async function pgSubmitAttempt(
  userId: string,
  payload: {
    questionId: string;
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
}> {
  const db = getPgDb();
  const [question] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.id, payload.questionId))
    .limit(1);
  if (!question) throw new Error('Questão não encontrada.');

  const cleanOption = clampStr(payload.selectedOption.toUpperCase(), 'A', 1, 5);
  const isCorrect =
    cleanOption === question.correctOption.trim().toUpperCase();

  await db.insert(questionAttemptsTable).values({
    userId,
    questionId: question.id,
    profileId: payload.profileId || null,
    subject: question.subject,
    topic: question.topic,
    board: question.board,
    selectedOption: cleanOption,
    isCorrect,
    timeSpentSec: Math.max(
      1,
      Math.min(3600, Math.round(Number(payload.timeSpentSec) || 45))
    ),
    isBookmarked: Boolean(payload.isBookmarked),
  });

  const xpEarned = isCorrect ? 25 : 10;
  const updatedUser = await addXpAndCheckStreak(userId, xpEarned);
  await awardAchievementIfMissing(
    userId,
    'first_question',
    'Primeira Questão Resolvida',
    'Iniciou sua jornada prática no banco de questões comentadas.'
  );

  return {
    isCorrect,
    correctOption: question.correctOption,
    commentary: question.commentary,
    xpEarned,
    user: updatedUser,
  };
}

export async function pgListPdfImports(): Promise<PdfImportHistory[]> {
  const db = getPgDb();
  const rows = await db
    .select()
    .from(pdfImportsTable)
    .orderBy(desc(pdfImportsTable.createdAt));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    fileName: r.fileName,
    board: r.board,
    career: r.career,
    year: r.year,
    extractedCount: r.extractedCount,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function pgCommitPdfQuestions(
  userId: string,
  payload: {
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
): Promise<{ insertedCount: number; user: UserProfile | null }> {
  const db = getPgDb();
  const cleanBoard = clampStr(payload.board, 'FGV', 2, 40);
  const cleanCareer = clampStr(payload.career, 'Tribunais', 2, 60);
  const cleanYear = Math.max(
    1990,
    Math.min(2035, Math.round(Number(payload.year) || 2025))
  );
  const cleanItems = payload.items.slice(0, 200);
  const stamp = Date.now().toString().slice(-6);

  const [pdfRow] = await db
    .insert(pdfImportsTable)
    .values({
      userId,
      title: clampStr(payload.title, 'Prova Importada', 2, 160),
      fileName: clampStr(payload.fileName, 'prova.pdf', 2, 160),
      board: cleanBoard,
      career: cleanCareer,
      year: cleanYear,
      extractedCount: cleanItems.length,
      status: 'processed',
    })
    .returning();

  if (cleanItems.length > 0) {
    await db.insert(questionsTable).values(
      cleanItems.map((item, idx) => {
        const validOpts =
          Array.isArray(item.options) && item.options.length >= 2
            ? item.options.slice(0, 5)
            : [
                { key: 'C', text: 'Certo' },
                { key: 'E', text: 'Errado' },
              ];
        return {
          code: `PDF-${cleanBoard.slice(0, 3).toUpperCase()}-${stamp}-${idx + 1}`,
          board: cleanBoard,
          career: cleanCareer,
          subject: clampStr(item.subject, 'Conhecimentos Gerais', 2, 80),
          topic: clampStr(item.topic, 'Tópico Extraído', 2, 140),
          organ: clampStr(
            item.organ || payload.title,
            'Prova Personalizada',
            2,
            100
          ),
          year: cleanYear,
          difficulty:
            item.difficulty === 'Fácil' || item.difficulty === 'Difícil'
              ? item.difficulty
              : 'Média',
          questionType:
            item.questionType === 'true_false'
              ? 'true_false'
              : 'multiple_choice',
          statement: clampStr(
            item.statement,
            'Enunciado extraído do PDF.',
            10,
            5000
          ),
          optionsJson: validOpts,
          correctOption: clampStr(
            String(item.correctOption || validOpts[0]?.key || 'A').toUpperCase(),
            'A',
            1,
            5
          ),
          commentary: clampStr(
            item.commentary,
            'Comentário gerado a partir do PDF.',
            5,
            5000
          ),
          sourceType: 'pdf_import',
          pdfImportId: pdfRow.id,
          createdByUserId: userId,
        };
      })
    );
  }

  const updatedUser = await addXpAndCheckStreak(userId, 60);
  await awardAchievementIfMissing(
    userId,
    'pdf_creator',
    'Curador de Provas PDF',
    'Transformou um caderno PDF em questões comentadas no banco.'
  );

  return { insertedCount: cleanItems.length, user: updatedUser };
}

export async function pgDeletePdfImport(pdfId: string): Promise<void> {
  const db = getPgDb();
  await db.delete(pdfImportsTable).where(eq(pdfImportsTable.id, pdfId));
}

export async function pgListScrapeHistory(): Promise<ScrapeJobHistory[]> {
  const db = getPgDb();
  const rows = await db
    .select()
    .from(scrapeJobsTable)
    .orderBy(desc(scrapeJobsTable.ranAt));
  return rows.map((r) => ({
    id: r.id,
    sourceName: r.sourceName,
    sourceUrl: r.sourceUrl,
    board: r.board,
    career: r.career,
    questionsImported: r.questionsImported,
    status: r.status,
    summary: r.summary,
    ranAt: r.ranAt.toISOString(),
  }));
}

export async function pgSaveScrapedQuestions(
  userId: string,
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
}> {
  const db = getPgDb();
  const cleanBoard = clampStr(payload.board, 'Cebraspe', 2, 40);
  const cleanCareer = clampStr(payload.career, 'Tribunais', 2, 60);
  const items = payload.questions.slice(0, 100);
  const stamp = Date.now().toString().slice(-6);

  let insertedQuestions: QuestionItem[] = [];
  if (items.length > 0) {
    const qRows = await db
      .insert(questionsTable)
      .values(
        items.map((item, idx) => {
          const validOpts =
            Array.isArray(item.options) && item.options.length >= 2
              ? item.options.slice(0, 5)
              : [
                  { key: 'C', text: 'Certo' },
                  { key: 'E', text: 'Errado' },
                ];
          return {
            code: `SCR-${cleanBoard.slice(0, 3).toUpperCase()}-${stamp}-${idx + 1}`,
            board: cleanBoard,
            career: cleanCareer,
            subject: clampStr(item.subject, 'Conhecimentos Gerais', 2, 80),
            topic: clampStr(item.topic, 'Edital Oficial', 2, 140),
            organ: clampStr(item.organ, payload.sourceName, 2, 100),
            year: 2025,
            difficulty:
              item.difficulty === 'Fácil' || item.difficulty === 'Difícil'
                ? item.difficulty
                : 'Média',
            questionType:
              item.questionType === 'true_false'
                ? 'true_false'
                : 'multiple_choice',
            statement: clampStr(item.statement, 'Enunciado coletado.', 10, 5000),
            optionsJson: validOpts,
            correctOption: clampStr(
              String(item.correctOption || validOpts[0]?.key || 'A').toUpperCase(),
              'A',
              1,
              5
            ),
            commentary: clampStr(
              item.commentary,
              'Comentário estruturado na coleta.',
              5,
              5000
            ),
            sourceType: 'portal_scrape',
            createdByUserId: userId,
          };
        })
      )
      .returning();
    insertedQuestions = qRows.map((r) => mapQuestion(r, null));
  }

  const [jobRow] = await db
    .insert(scrapeJobsTable)
    .values({
      userId,
      sourceName: clampStr(payload.sourceName, 'Portal Oficial', 2, 160),
      sourceUrl: clampStr(
        payload.sourceUrl,
        'https://www.cebraspe.org.br',
        8,
        500
      ),
      board: cleanBoard,
      career: cleanCareer,
      questionsImported: items.length,
      status: 'completed',
      summary: clampStr(payload.summary, 'Coleta concluída.', 0, 600),
    })
    .returning();

  return {
    insertedCount: insertedQuestions.length,
    questions: insertedQuestions,
    job: {
      id: jobRow.id,
      sourceName: jobRow.sourceName,
      sourceUrl: jobRow.sourceUrl,
      board: jobRow.board,
      career: jobRow.career,
      questionsImported: jobRow.questionsImported,
      status: jobRow.status,
      summary: jobRow.summary,
      ranAt: jobRow.ranAt.toISOString(),
    },
  };
}

export async function pgListMockExamsAndRankings(userId: string): Promise<{
  myExams: MockExamRecord[];
  rankings: RankingEntry[];
}> {
  const db = getPgDb();
  const [examRows, userRows, allExamStats] = await Promise.all([
    db
      .select()
      .from(mockExamsTable)
      .where(eq(mockExamsTable.userId, userId))
      .orderBy(desc(mockExamsTable.createdAt)),
    db
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.xp))
      .limit(20),
    db
      .select({
        userId: mockExamsTable.userId,
        bestScore: sql<number>`coalesce(max(${mockExamsTable.netScore}), 0)::int`,
        examsCount: sql<number>`count(*)::int`,
      })
      .from(mockExamsTable)
      .groupBy(mockExamsTable.userId),
  ]);

  const statMap = new Map(
    allExamStats.map((s) => [
      s.userId,
      { bestScore: s.bestScore, examsCount: s.examsCount },
    ])
  );

  return {
    myExams: examRows.map((e) => ({
      id: e.id,
      title: e.title,
      board: e.board,
      career: e.career,
      durationMinutes: e.durationMinutes,
      elapsedSeconds: e.elapsedSeconds,
      totalQuestions: e.totalQuestions,
      correctCount: e.correctCount,
      wrongCount: e.wrongCount,
      blankCount: e.blankCount,
      netScore: e.netScore,
      breakdownJson: e.breakdownJson,
      createdAt: e.createdAt.toISOString(),
    })),
    rankings: userRows.map((u) => {
      const s = statMap.get(u.id);
      return {
        userId: u.id,
        displayName: u.displayName || u.email.split('@')[0],
        xp: u.xp,
        level: u.level,
        streakDays: u.streakDays,
        bestScore: s?.bestScore ?? 0,
        examsCount: s?.examsCount ?? 0,
      };
    }),
  };
}

export async function pgSubmitMockExam(
  userId: string,
  payload: {
    title: string;
    board: string;
    career: string;
    durationMinutes: number;
    elapsedSeconds: number;
    cebraspePenalty: boolean;
    questionIds: string[];
    answers: Record<string, string>;
  }
) {
  const db = getPgDb();
  const qRows = await db.select().from(questionsTable);
  const qMap = new Map(qRows.map((q) => [q.id, q]));
  const orderedQuestions = payload.questionIds
    .map((id) => qMap.get(id))
    .filter((q): q is typeof questionsTable.$inferSelect => Boolean(q));

  let correctCount = 0;
  let wrongCount = 0;
  let blankCount = 0;
  const subjectMap = new Map<string, { total: number; correct: number }>();
  const detailedResults: {
    questionId: string;
    subject: string;
    statement: string;
    selectedOption: string | null;
    correctOption: string;
    isCorrect: boolean;
    commentary: string;
  }[] = [];

  const perQSec = Math.max(
    15,
    Math.min(
      3600,
      Math.round(
        (Number(payload.elapsedSeconds) || 300) /
          Math.max(1, orderedQuestions.length)
      )
    )
  );

  const attemptInserts: (typeof questionAttemptsTable.$inferInsert)[] = [];

  for (const q of orderedQuestions) {
    const bucket = subjectMap.get(q.subject) || { total: 0, correct: 0 };
    bucket.total += 1;

    const sel = payload.answers[q.id]
      ? String(payload.answers[q.id]).trim().toUpperCase()
      : null;
    const isCorrect =
      sel !== null && sel === q.correctOption.trim().toUpperCase();

    if (!sel) {
      blankCount += 1;
    } else if (isCorrect) {
      correctCount += 1;
      bucket.correct += 1;
    } else {
      wrongCount += 1;
    }
    subjectMap.set(q.subject, bucket);

    if (sel) {
      attemptInserts.push({
        userId,
        questionId: q.id,
        subject: q.subject,
        topic: q.topic,
        board: q.board,
        selectedOption: clampStr(sel, 'A', 1, 5),
        isCorrect,
        timeSpentSec: perQSec,
        isBookmarked: !isCorrect,
      });
    }

    detailedResults.push({
      questionId: q.id,
      subject: q.subject,
      statement: q.statement,
      selectedOption: sel,
      correctOption: q.correctOption,
      isCorrect,
      commentary: q.commentary,
    });
  }

  if (attemptInserts.length > 0) {
    await db.insert(questionAttemptsTable).values(attemptInserts);
  }

  const rawNet = payload.cebraspePenalty
    ? Math.max(0, correctCount - wrongCount)
    : correctCount;
  const netScore =
    orderedQuestions.length > 0
      ? Math.round((rawNet / orderedQuestions.length) * 100)
      : 0;

  const breakdownJson = Array.from(subjectMap.entries()).map(
    ([subject, val]) => ({
      subject,
      total: val.total,
      correct: val.correct,
    })
  );

  const [examRow] = await db
    .insert(mockExamsTable)
    .values({
      userId,
      title: clampStr(payload.title, 'Simulado Personalizado', 2, 140),
      board: clampStr(payload.board, 'Todas', 2, 40),
      career: clampStr(payload.career, 'Todas', 2, 60),
      durationMinutes: Math.max(
        1,
        Math.min(360, Math.round(Number(payload.durationMinutes) || 20))
      ),
      elapsedSeconds: Math.max(
        0,
        Math.min(21600, Math.round(Number(payload.elapsedSeconds) || 0))
      ),
      totalQuestions: orderedQuestions.length,
      correctCount,
      wrongCount,
      blankCount,
      netScore,
      status: 'completed',
      breakdownJson:
        breakdownJson.length > 0
          ? breakdownJson
          : [
              {
                subject: 'Geral',
                total: orderedQuestions.length,
                correct: correctCount,
              },
            ],
    })
    .returning();

  const updatedUser = await addXpAndCheckStreak(userId, 100);
  await awardAchievementIfMissing(
    userId,
    'simulado_finisher',
    'Maratonista de Simulado',
    'Concluiu um simulado cronometrado completo com diagnóstico.'
  );

  return {
    exam: {
      id: examRow.id,
      title: examRow.title,
      board: examRow.board,
      career: examRow.career,
      durationMinutes: examRow.durationMinutes,
      elapsedSeconds: examRow.elapsedSeconds,
      totalQuestions: examRow.totalQuestions,
      correctCount: examRow.correctCount,
      wrongCount: examRow.wrongCount,
      blankCount: examRow.blankCount,
      netScore: examRow.netScore,
      breakdownJson: examRow.breakdownJson,
      createdAt: examRow.createdAt.toISOString(),
    },
    detailedResults,
    user: updatedUser,
  };
}

export async function pgGetAnalytics(userId: string): Promise<{
  subjectStats: SubjectStat[];
  recentErrors: { subject: string; topic: string; board: string }[];
}> {
  const db = getPgDb();
  const attempts = await db
    .select()
    .from(questionAttemptsTable)
    .where(eq(questionAttemptsTable.userId, userId))
    .orderBy(desc(questionAttemptsTable.createdAt));

  const buckets = new Map<
    string,
    { total: number; correct: number; totalSec: number }
  >();
  for (const att of attempts) {
    const b = buckets.get(att.subject) || {
      total: 0,
      correct: 0,
      totalSec: 0,
    };
    b.total += 1;
    if (att.isCorrect) b.correct += 1;
    b.totalSec += att.timeSpentSec;
    buckets.set(att.subject, b);
  }

  return {
    subjectStats: Array.from(buckets.entries()).map(([subject, b]) => ({
      subject,
      total: b.total,
      correct: b.correct,
      avgSeconds: Math.round(b.totalSec / Math.max(1, b.total)),
    })),
    recentErrors: attempts
      .filter((a) => !a.isCorrect)
      .slice(0, 12)
      .map((a) => ({
        subject: a.subject,
        topic: a.topic,
        board: a.board,
      })),
  };
}

export async function pgListSchedules(
  userId: string
): Promise<StudyScheduleItem[]> {
  const db = getPgDb();
  const rows = await db
    .select()
    .from(studySchedulesTable)
    .where(eq(studySchedulesTable.userId, userId))
    .orderBy(studySchedulesTable.dayOfWeek, studySchedulesTable.startTime);
  return rows.map((r) => ({
    id: r.id,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    durationMinutes: r.durationMinutes,
    subject: r.subject,
    focusType: r.focusType,
    completed: r.completed,
    calendarEventId: r.calendarEventId,
  }));
}

export async function pgCreateSchedule(
  userId: string,
  payload: {
    dayOfWeek: number;
    startTime: string;
    durationMinutes: number;
    subject: string;
    focusType: string;
  }
): Promise<StudyScheduleItem> {
  const db = getPgDb();
  const [created] = await db
    .insert(studySchedulesTable)
    .values({
      userId,
      dayOfWeek: Math.max(
        0,
        Math.min(6, Math.round(Number(payload.dayOfWeek) || 0))
      ),
      startTime: clampStr(payload.startTime, '19:00', 4, 10),
      durationMinutes: Math.max(
        10,
        Math.min(480, Math.round(Number(payload.durationMinutes) || 90))
      ),
      subject: clampStr(payload.subject, 'Disciplina', 2, 100),
      focusType: clampStr(payload.focusType, 'Questões', 2, 40),
      completed: false,
    })
    .returning();

  return {
    id: created.id,
    dayOfWeek: created.dayOfWeek,
    startTime: created.startTime,
    durationMinutes: created.durationMinutes,
    subject: created.subject,
    focusType: created.focusType,
    completed: created.completed,
    calendarEventId: created.calendarEventId,
  };
}

export async function pgUpdateSchedule(
  userId: string,
  scheduleId: string,
  updates: { completed?: boolean; calendarEventId?: string }
): Promise<StudyScheduleItem> {
  const db = getPgDb();
  const patch: Partial<typeof studySchedulesTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (typeof updates.completed === 'boolean') {
    patch.completed = updates.completed;
  }
  if (typeof updates.calendarEventId === 'string' && updates.calendarEventId) {
    patch.calendarEventId = updates.calendarEventId.slice(0, 256);
  }

  const [updated] = await db
    .update(studySchedulesTable)
    .set(patch)
    .where(
      and(
        eq(studySchedulesTable.id, scheduleId),
        eq(studySchedulesTable.userId, userId)
      )
    )
    .returning();
  if (!updated) throw new Error('Sessão do cronograma não encontrada.');

  return {
    id: updated.id,
    dayOfWeek: updated.dayOfWeek,
    startTime: updated.startTime,
    durationMinutes: updated.durationMinutes,
    subject: updated.subject,
    focusType: updated.focusType,
    completed: updated.completed,
    calendarEventId: updated.calendarEventId,
  };
}

export async function pgDeleteSchedule(
  userId: string,
  scheduleId: string
): Promise<void> {
  const db = getPgDb();
  await db
    .delete(studySchedulesTable)
    .where(
      and(
        eq(studySchedulesTable.id, scheduleId),
        eq(studySchedulesTable.userId, userId)
      )
    );
}

export async function pgExportBackup(userId: string) {
  const db = getPgDb();
  const [[userRow], profiles, schedules, mockExams] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db
      .select()
      .from(studyProfilesTable)
      .where(eq(studyProfilesTable.userId, userId)),
    db
      .select()
      .from(studySchedulesTable)
      .where(eq(studySchedulesTable.userId, userId)),
    db
      .select()
      .from(mockExamsTable)
      .where(eq(mockExamsTable.userId, userId)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    platform: 'AprovaFoco',
    user: userRow
      ? {
          email: userRow.email,
          displayName: userRow.displayName,
          xp: userRow.xp,
          level: userRow.level,
          streakDays: userRow.streakDays,
        }
      : null,
    profiles,
    schedules,
    mockExams,
  };
}

export async function pgListForumPosts(): Promise<ForumPostItem[]> {
  const db = getPgDb();
  const rows = await db
    .select()
    .from(forumPostsTable)
    .orderBy(desc(forumPostsTable.createdAt))
    .limit(40);
  return rows.map((r) => ({
    id: r.id,
    questionId: r.questionId,
    subject: r.subject,
    title: r.title,
    body: r.body,
    authorName: r.authorName,
    upvotes: r.upvotes,
    repliesJson: Array.isArray(r.repliesJson) ? r.repliesJson : [],
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function pgCreateForumPost(
  userId: string,
  authorName: string,
  payload: {
    title: string;
    body: string;
    subject: string;
    questionId?: string | null;
  }
): Promise<ForumPostItem> {
  const db = getPgDb();
  const [created] = await db
    .insert(forumPostsTable)
    .values({
      userId,
      questionId: payload.questionId || null,
      subject: clampStr(payload.subject, 'Direito Constitucional', 2, 80),
      title: clampStr(payload.title, 'Dúvida de estudo', 3, 140),
      body: clampStr(payload.body, 'Descrição da dúvida.', 3, 3000),
      authorName: clampStr(authorName, 'Estudante', 1, 60),
      upvotes: 1,
      repliesJson: [],
    })
    .returning();

  return {
    id: created.id,
    questionId: created.questionId,
    subject: created.subject,
    title: created.title,
    body: created.body,
    authorName: created.authorName,
    upvotes: created.upvotes,
    repliesJson: created.repliesJson,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function pgReplyForumPost(
  postId: string,
  authorName: string,
  text: string
): Promise<ForumPostItem> {
  const db = getPgDb();
  const [existing] = await db
    .select()
    .from(forumPostsTable)
    .where(eq(forumPostsTable.id, postId))
    .limit(1);
  if (!existing) throw new Error('Tópico não encontrado.');

  const updatedReplies = [
    ...(Array.isArray(existing.repliesJson) ? existing.repliesJson : []),
    {
      id: `${Date.now()}`,
      author: clampStr(authorName, 'Estudante', 1, 60),
      text: text.trim().slice(0, 1200),
      createdAt: new Date().toISOString(),
    },
  ];

  const [updated] = await db
    .update(forumPostsTable)
    .set({ repliesJson: updatedReplies, updatedAt: new Date() })
    .where(eq(forumPostsTable.id, postId))
    .returning();

  return {
    id: updated.id,
    questionId: updated.questionId,
    subject: updated.subject,
    title: updated.title,
    body: updated.body,
    authorName: updated.authorName,
    upvotes: updated.upvotes,
    repliesJson: updated.repliesJson,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function pgUpvoteForumPost(
  postId: string
): Promise<ForumPostItem> {
  const db = getPgDb();
  const [updated] = await db
    .update(forumPostsTable)
    .set({
      upvotes: sql`${forumPostsTable.upvotes} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(forumPostsTable.id, postId))
    .returning();
  if (!updated) throw new Error('Tópico não encontrado.');

  return {
    id: updated.id,
    questionId: updated.questionId,
    subject: updated.subject,
    title: updated.title,
    body: updated.body,
    authorName: updated.authorName,
    upvotes: updated.upvotes,
    repliesJson: updated.repliesJson,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function pgListChatMessages(
  room: string
): Promise<ChatMessageItem[]> {
  const db = getPgDb();
  const rows = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.room, room))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(50);

  return rows
    .reverse()
    .map((r) => ({
      id: r.id,
      room: r.room,
      authorName: r.authorName,
      authorLevel: r.authorLevel,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    }));
}

export async function pgSaveChatMessage(
  userId: string,
  authorName: string,
  authorLevel: number,
  room: string,
  message: string
): Promise<ChatMessageItem> {
  const db = getPgDb();
  const [created] = await db
    .insert(chatMessagesTable)
    .values({
      userId,
      room: clampStr(room, 'geral', 2, 40),
      authorName: clampStr(authorName, 'Estudante', 1, 60),
      authorLevel: Math.max(1, Math.min(1000, authorLevel || 1)),
      message: clampStr(message, 'Mensagem', 1, 800),
    })
    .returning();

  return {
    id: created.id,
    room: created.room,
    authorName: created.authorName,
    authorLevel: created.authorLevel,
    message: created.message,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function pgFindUserById(userId: string): Promise<UserProfile | null> {
  const db = getPgDb();
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return row ? mapUser(row) : null;
}

export async function pgFindQuestionById(
  questionId: string,
  userId?: string
): Promise<QuestionItem | null> {
  const db = getPgDb();
  const [row] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.id, questionId))
    .limit(1);
  if (!row) return null;

  let attempt: {
    selectedOption: string;
    isCorrect: boolean;
    isBookmarked: boolean;
  } | null = null;

  if (userId) {
    const [att] = await db
      .select()
      .from(questionAttemptsTable)
      .where(
        and(
          eq(questionAttemptsTable.userId, userId),
          eq(questionAttemptsTable.questionId, questionId)
        )
      )
      .orderBy(desc(questionAttemptsTable.createdAt))
      .limit(1);
    if (att) {
      attempt = {
        selectedOption: att.selectedOption,
        isCorrect: att.isCorrect,
        isBookmarked: att.isBookmarked,
      };
    }
  }

  return mapQuestion(row, attempt);
}

export async function pgFindMockExamById(
  examId: string,
  userId: string
): Promise<MockExamRecord | null> {
  const db = getPgDb();
  const [row] = await db
    .select()
    .from(mockExamsTable)
    .where(
      and(eq(mockExamsTable.id, examId), eq(mockExamsTable.userId, userId))
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    board: row.board,
    career: row.career,
    durationMinutes: row.durationMinutes,
    elapsedSeconds: row.elapsedSeconds,
    totalQuestions: row.totalQuestions,
    correctCount: row.correctCount,
    wrongCount: row.wrongCount,
    blankCount: row.blankCount,
    netScore: row.netScore,
    breakdownJson: row.breakdownJson,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function pgFindPdfImportById(
  pdfId: string
): Promise<PdfImportHistory | null> {
  const db = getPgDb();
  const [row] = await db
    .select()
    .from(pdfImportsTable)
    .where(eq(pdfImportsTable.id, pdfId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    fileName: row.fileName,
    board: row.board,
    career: row.career,
    year: row.year,
    extractedCount: row.extractedCount,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
