import type { User as FirebaseUser } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
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
import { auth, db } from './firebase';
import { SEED_QUESTIONS } from './seedQuestions';

export const BOOTSTRAP_ADMIN_EMAIL = 'maiquelbsb@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function toIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof (val as any).toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  if (typeof val === 'string' && val) {
    return val;
  }
  return new Date().toISOString();
}

function clampStr(val: unknown, fallback: string, min: number, max: number): string {
  const s = String(val ?? '').trim();
  const base = s.length >= min ? s : fallback;
  return base.slice(0, max);
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function mapUserDoc(uid: string, data: Record<string, any>): UserProfile {
  return {
    id: uid,
    uid,
    email: String(data.email || ''),
    displayName: data.displayName || null,
    avatarUrl: data.avatarUrl || null,
    role: (data.role as UserRole) || 'user',
    xp: Number(data.xp || 0),
    level: Number(data.level || 1),
    streakDays: Number(data.streakDays || 1),
    lastStudyDate: data.lastStudyDate || null,
    planTier: String(data.planTier || 'premium_trial'),
    dailyGoal: Number(data.dailyGoal || 20),
    pushEnabled: Boolean(data.pushEnabled),
    preferredTheme: data.preferredTheme === 'dark' ? 'dark' : 'light',
  };
}

function mapQuestionDoc(id: string, data: Record<string, any>): QuestionItem {
  return {
    id,
    code: String(data.code || id),
    board: String(data.board || 'FGV'),
    career: String(data.career || 'Tribunais'),
    subject: String(data.subject || 'Direito Constitucional'),
    topic: String(data.topic || 'Geral'),
    organ: String(data.organ || 'Órgão Público'),
    year: Number(data.year || 2024),
    difficulty: String(data.difficulty || 'Média'),
    questionType:
      data.questionType === 'true_false' ? 'true_false' : 'multiple_choice',
    statement: String(data.statement || ''),
    optionsJson: Array.isArray(data.optionsJson) ? data.optionsJson : [],
    correctOption: String(data.correctOption || 'A'),
    commentary: String(data.commentary || ''),
    sourceType: String(data.sourceType || 'curated'),
    pdfImportId: data.pdfImportId ? String(data.pdfImportId) : undefined,
    createdByUserId: data.createdByUserId
      ? String(data.createdByUserId)
      : undefined,
    createdAt: toIso(data.createdAt),
  };
}

async function seedQuestionsIfEmpty(uid: string, role: UserRole) {
  if (role !== 'admin' && role !== 'editor') return;

  const questionsPath = 'questions';
  try {
    const existingSnap = await getDocs(
      query(collection(db, questionsPath), where('year', '>=', 1990), limit(1))
    );
    if (!existingSnap.empty) return;

    const batch = writeBatch(db);
    SEED_QUESTIONS.forEach((q, idx) => {
      const docId = `seed_${String(idx + 1).padStart(3, '0')}`;
      batch.set(doc(db, questionsPath, docId), {
        code: q.code,
        board: q.board,
        career: q.career,
        subject: q.subject,
        topic: q.topic,
        organ: q.organ,
        year: q.year,
        difficulty: q.difficulty,
        questionType: q.questionType,
        statement: q.statement,
        optionsJson: q.optionsJson,
        correctOption: q.correctOption,
        commentary: q.commentary,
        sourceType: 'curated',
        createdByUserId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    if (role === 'admin') {
      batch.set(doc(db, 'scrapeJobs', 'seed_scrape_cebraspe'), {
        userId: uid,
        sourceName: 'Portal Oficial Cebraspe — Provas Aplicadas',
        sourceUrl: 'https://www.cebraspe.org.br/concursos',
        board: 'Cebraspe',
        career: 'Tribunais',
        questionsImported: 8,
        status: 'completed',
        summary:
          'Sincronização inicial concluída com validação automática de gabarito e comentários.',
        ranAt: serverTimestamp(),
      });
      batch.set(doc(db, 'scrapeJobs', 'seed_scrape_fgv'), {
        userId: uid,
        sourceName: 'FGV Conhecimento — Cadernos Públicos',
        sourceUrl: 'https://conhecimento.fgv.br/concursos',
        board: 'FGV',
        career: 'Fiscal',
        questionsImported: 6,
        status: 'completed',
        summary:
          'Acervo de Direito Tributário e Português atualizado a partir do portal oficial.',
        ranAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, questionsPath);
  }
}

export async function syncCurrentUserAndWorkspace(fbUser: FirebaseUser): Promise<{
  user: UserProfile;
  profiles: StudyGoalProfile[];
  achievements: AchievementBadge[];
  summary: {
    totalAttempts: number;
    correctAttempts: number;
    totalBankQuestions: number;
  };
}> {
  const uid = fbUser.uid;
  const userPath = `users/${uid}`;
  const isBootstrap =
    (fbUser.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  let userSnap;
  try {
    userSnap = await getDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  let userProfile: UserProfile;
  const today = new Date().toISOString().slice(0, 10);

  if (!userSnap.exists()) {
    const cleanEmail = clampStr(
      fbUser.email || `${uid}@aprovafoco.app`,
      `${uid}@aprovafoco.app`,
      3,
      160
    );
    const cleanName = clampStr(
      fbUser.displayName || cleanEmail.split('@')[0],
      'Estudante',
      2,
      60
    );
    const assignedRole: UserRole = isBootstrap ? 'admin' : 'user';

    const newUserPayload: Record<string, any> = {
      uid,
      email: cleanEmail,
      displayName: cleanName,
      role: assignedRole,
      xp: 0,
      level: 1,
      streakDays: 1,
      lastStudyDate: today,
      planTier: 'premium_trial',
      dailyGoal: 20,
      pushEnabled: false,
      preferredTheme: 'light',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (fbUser.photoURL && fbUser.photoURL.length <= 500) {
      newUserPayload.avatarUrl = fbUser.photoURL;
    }

    try {
      await setDoc(doc(db, 'users', uid), newUserPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    // Create public-safe ranking projection + starter profiles + schedules
    const batch = writeBatch(db);
    batch.set(doc(db, 'rankings', uid), {
      uid,
      displayName: cleanName,
      xp: 0,
      level: 1,
      streakDays: 1,
      bestScore: 0,
      examsCount: 0,
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'users', uid, 'profiles', 'profile_tribunais'), {
      userId: uid,
      name: 'Tribunais — Analista Judiciário',
      career: 'Tribunais',
      targetBoard: 'FGV',
      dailyHours: 4,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'users', uid, 'profiles', 'profile_fiscal'), {
      userId: uid,
      name: 'Receita & Fiscos Estaduais',
      career: 'Fiscal',
      targetBoard: 'Cebraspe',
      dailyHours: 3,
      isActive: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const defaultSchedules = [
      {
        dayOfWeek: 1,
        startTime: '19:00',
        durationMinutes: 90,
        subject: 'Direito Constitucional',
        focusType: 'Questões',
      },
      {
        dayOfWeek: 2,
        startTime: '19:00',
        durationMinutes: 90,
        subject: 'Direito Administrativo',
        focusType: 'Teoria PDF',
      },
      {
        dayOfWeek: 3,
        startTime: '19:00',
        durationMinutes: 90,
        subject: 'Língua Portuguesa',
        focusType: 'Questões',
      },
      {
        dayOfWeek: 4,
        startTime: '19:00',
        durationMinutes: 90,
        subject: 'Raciocínio Lógico',
        focusType: 'Revisão IA',
      },
      {
        dayOfWeek: 5,
        startTime: '19:00',
        durationMinutes: 90,
        subject: 'Direito Tributário',
        focusType: 'Questões',
      },
      {
        dayOfWeek: 6,
        startTime: '09:00',
        durationMinutes: 120,
        subject: 'Simulado Semanal',
        focusType: 'Simulado',
      },
    ];
    defaultSchedules.forEach((s, idx) => {
      batch.set(doc(db, 'users', uid, 'schedules', `sched_init_${idx + 1}`), {
        userId: uid,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        durationMinutes: s.durationMinutes,
        subject: s.subject,
        focusType: s.focusType,
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }

    const refreshedSnap = await getDoc(doc(db, 'users', uid));
    userProfile = mapUserDoc(uid, refreshedSnap.data() || newUserPayload);
  } else {
    userProfile = mapUserDoc(uid, userSnap.data());
    // Ensure ranking projection exists
    try {
      const rankSnap = await getDoc(doc(db, 'rankings', uid));
      if (!rankSnap.exists()) {
        await setDoc(doc(db, 'rankings', uid), {
          uid,
          displayName: clampStr(
            userProfile.displayName || userProfile.email.split('@')[0],
            'Estudante',
            2,
            60
          ),
          xp: userProfile.xp,
          level: userProfile.level,
          streakDays: userProfile.streakDays,
          bestScore: 0,
          examsCount: 0,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Non-fatal
    }
  }

  await seedQuestionsIfEmpty(uid, userProfile.role);

  let profiles: StudyGoalProfile[] = [];
  let achievements: AchievementBadge[] = [];
  let totalAttempts = 0;
  let correctAttempts = 0;
  let totalBankQuestions = 0;

  try {
    const [profSnap, achSnap, attSnap, qSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'users', uid, 'profiles'),
          where('userId', '==', uid)
        )
      ),
      getDocs(
        query(
          collection(db, 'users', uid, 'achievements'),
          where('userId', '==', uid)
        )
      ),
      getDocs(
        query(
          collection(db, 'users', uid, 'attempts'),
          where('userId', '==', uid)
        )
      ),
      getDocs(
        query(collection(db, 'questions'), where('year', '>=', 1990))
      ),
    ]);

    profiles = profSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: String(data.userId),
          name: String(data.name || ''),
          career: String(data.career || 'Tribunais'),
          targetBoard: String(data.targetBoard || 'FGV'),
          examDate: data.examDate || null,
          dailyHours: Number(data.dailyHours || 3),
          isActive: Boolean(data.isActive),
        };
      })
      .sort((a, b) => Number(b.isActive) - Number(a.isActive));

    achievements = achSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          badgeKey: String(data.badgeKey || d.id),
          title: String(data.title || ''),
          description: String(data.description || ''),
          unlockedAt: toIso(data.unlockedAt),
        };
      })
      .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt));

    totalAttempts = attSnap.size;
    correctAttempts = attSnap.docs.filter((d) => Boolean(d.data().isCorrect)).length;
    totalBankQuestions = qSnap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${uid}`);
  }

  return {
    user: userProfile,
    profiles,
    achievements,
    summary: {
      totalAttempts,
      correctAttempts,
      totalBankQuestions,
    },
  };
}

export async function updateMyPreferences(
  uid: string,
  updates: {
    displayName?: string;
    preferredTheme?: 'light' | 'dark';
    dailyGoal?: number;
    pushEnabled?: boolean;
    planTier?: string;
  }
): Promise<UserProfile> {
  const path = `users/${uid}`;
  const cleanUpdates: Record<string, any> = { updatedAt: serverTimestamp() };

  if (typeof updates.displayName === 'string') {
    const cleaned = updates.displayName.trim();
    if (cleaned.length < 2 || cleaned.length > 60) {
      throw new Error('O nome de exibição deve ter entre 2 e 60 caracteres.');
    }
    cleanUpdates.displayName = cleaned;
  }
  if (updates.preferredTheme === 'light' || updates.preferredTheme === 'dark') {
    cleanUpdates.preferredTheme = updates.preferredTheme;
  }
  if (typeof updates.dailyGoal === 'number') {
    cleanUpdates.dailyGoal = Math.max(5, Math.min(200, Math.round(updates.dailyGoal)));
  }
  if (typeof updates.pushEnabled === 'boolean') {
    cleanUpdates.pushEnabled = updates.pushEnabled;
  }
  if (
    updates.planTier === 'free' ||
    updates.planTier === 'premium_monthly' ||
    updates.planTier === 'premium_trial'
  ) {
    cleanUpdates.planTier = updates.planTier;
  }

  try {
    await updateDoc(doc(db, 'users', uid), cleanUpdates);
    if (cleanUpdates.displayName) {
      await updateDoc(doc(db, 'rankings', uid), {
        displayName: cleanUpdates.displayName,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    const snap = await getDoc(doc(db, 'users', uid));
    return mapUserDoc(uid, snap.data() || {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createStudyProfile(
  uid: string,
  payload: {
    name: string;
    career: string;
    targetBoard: string;
    examDate?: string | null;
    dailyHours?: number;
  }
): Promise<StudyGoalProfile> {
  const path = `users/${uid}/profiles`;
  try {
    const existingSnap = await getDocs(
      query(collection(db, 'users', uid, 'profiles'), where('userId', '==', uid))
    );
    const batch = writeBatch(db);
    existingSnap.docs.forEach((d) => {
      if (d.data().isActive) {
        batch.update(d.ref, { isActive: false, updatedAt: serverTimestamp() });
      }
    });

    const newId = makeDocId('prof');
    const newDoc: Record<string, any> = {
      userId: uid,
      name: clampStr(payload.name, 'Novo Edital', 2, 100),
      career: clampStr(payload.career, 'Tribunais', 2, 60),
      targetBoard: clampStr(payload.targetBoard, 'FGV', 2, 40),
      dailyHours: Math.max(1, Math.min(18, Number(payload.dailyHours) || 3)),
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (payload.examDate && String(payload.examDate).trim()) {
      newDoc.examDate = String(payload.examDate).trim().slice(0, 30);
    }

    batch.set(doc(db, 'users', uid, 'profiles', newId), newDoc);
    await batch.commit();

    return {
      id: newId,
      userId: uid,
      name: newDoc.name,
      career: newDoc.career,
      targetBoard: newDoc.targetBoard,
      examDate: newDoc.examDate || null,
      dailyHours: newDoc.dailyHours,
      isActive: true,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function activateStudyProfile(uid: string, profileId: string): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}`;
  try {
    const existingSnap = await getDocs(
      query(collection(db, 'users', uid, 'profiles'), where('userId', '==', uid))
    );
    const batch = writeBatch(db);
    existingSnap.docs.forEach((d) => {
      batch.update(d.ref, {
        isActive: d.id === profileId,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

async function awardAchievementIfMissing(
  uid: string,
  badgeKey: string,
  title: string,
  description: string
) {
  const achPath = `users/${uid}/achievements/${badgeKey}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'achievements', badgeKey));
    if (!snap.exists()) {
      await setDoc(doc(db, 'users', uid, 'achievements', badgeKey), {
        userId: uid,
        badgeKey,
        title: clampStr(title, 'Conquista', 2, 120),
        description: clampStr(description, 'Marco alcançado.', 2, 240),
        unlockedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, achPath);
  }
}

async function addXpAndCheckStreak(
  uid: string,
  xpDelta: number,
  extraRanking?: { bestScore?: number; examsIncrement?: number }
): Promise<UserProfile | null> {
  const userPath = `users/${uid}`;
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) return null;
    const current = userSnap.data();

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    let nextStreak = Number(current.streakDays || 1);
    if (current.lastStudyDate === yesterday) {
      nextStreak += 1;
    } else if (current.lastStudyDate !== today) {
      nextStreak = Math.max(1, nextStreak);
    }

    const nextXp = Number(current.xp || 0) + xpDelta;
    const nextLevel = Math.floor(nextXp / 250) + 1;

    await updateDoc(doc(db, 'users', uid), {
      xp: nextXp,
      level: nextLevel,
      streakDays: nextStreak,
      lastStudyDate: today,
      updatedAt: serverTimestamp(),
    });

    const rankSnap = await getDoc(doc(db, 'rankings', uid));
    if (rankSnap.exists()) {
      const rData = rankSnap.data();
      await updateDoc(doc(db, 'rankings', uid), {
        displayName: clampStr(
          current.displayName || String(current.email || '').split('@')[0],
          'Estudante',
          2,
          60
        ),
        xp: nextXp,
        level: nextLevel,
        streakDays: nextStreak,
        bestScore: Math.max(
          Number(rData.bestScore || 0),
          Number(extraRanking?.bestScore || 0)
        ),
        examsCount:
          Number(rData.examsCount || 0) + Number(extraRanking?.examsIncrement || 0),
        updatedAt: serverTimestamp(),
      });
    }

    if (nextStreak >= 3) {
      await awardAchievementIfMissing(
        uid,
        'streak_3',
        'Constância Inabalável',
        'Manteve 3 dias consecutivos de prática no edital.'
      );
    }

    const updatedSnap = await getDoc(doc(db, 'users', uid));
    return mapUserDoc(uid, updatedSnap.data() || {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function queryQuestions(
  uid: string,
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
  try {
    const [qSnap, attSnap] = await Promise.all([
      getDocs(query(collection(db, 'questions'), where('year', '>=', 1990))),
      getDocs(
        query(
          collection(db, 'users', uid, 'attempts'),
          where('userId', '==', uid)
        )
      ),
    ]);

    const sortedAttempts = attSnap.docs
      .map((d) => ({
        questionId: String(d.data().questionId),
        selectedOption: String(d.data().selectedOption || ''),
        isCorrect: Boolean(d.data().isCorrect),
        isBookmarked: Boolean(d.data().isBookmarked),
        createdAt: toIso(d.data().createdAt),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const attemptMap = new Map<
      string,
      { selectedOption: string; isCorrect: boolean; isBookmarked: boolean }
    >();
    for (const att of sortedAttempts) {
      if (!attemptMap.has(att.questionId)) {
        attemptMap.set(att.questionId, {
          selectedOption: att.selectedOption,
          isCorrect: att.isCorrect,
          isBookmarked: att.isBookmarked,
        });
      }
    }

    let items = qSnap.docs
      .map((d) => {
        const mapped = mapQuestionDoc(d.id, d.data());
        return {
          ...mapped,
          userAttempt: attemptMap.get(d.id) || null,
        };
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (filters.board && filters.board !== 'Todas') {
      items = items.filter((q) => q.board === filters.board);
    }
    if (filters.career && filters.career !== 'Todas') {
      items = items.filter((q) => q.career === filters.career);
    }
    if (filters.subject && filters.subject !== 'Todas') {
      items = items.filter((q) => q.subject === filters.subject);
    }
    if (filters.difficulty && filters.difficulty !== 'Todas') {
      items = items.filter((q) => q.difficulty === filters.difficulty);
    }
    if (filters.sourceType && filters.sourceType !== 'Todos') {
      items = items.filter((q) => q.sourceType === filters.sourceType);
    }
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      items = items.filter(
        (q) =>
          q.statement.toLowerCase().includes(term) ||
          q.topic.toLowerCase().includes(term) ||
          q.organ.toLowerCase().includes(term) ||
          q.code.toLowerCase().includes(term)
      );
    }

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
    const sliced = items.slice(0, filters.limitCount || 40);
    return { questions: sliced, total };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'questions');
  }
}

export async function fetchOfflinePackQuestions(): Promise<QuestionItem[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'questions'), where('year', '>=', 1990), limit(100))
    );
    return snap.docs.map((d) => mapQuestionDoc(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'questions');
  }
}

export async function createManualQuestion(
  uid: string,
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
  const newId = makeDocId('q_man');
  const cleanBoard = clampStr(payload.board, 'FGV', 2, 40);
  const stamp = Date.now().toString().slice(-6);
  const code = `MAN-${cleanBoard.slice(0, 3).toUpperCase()}-${stamp}`;

  const docData = {
    code,
    board: cleanBoard,
    career: clampStr(payload.career, 'Tribunais', 2, 60),
    subject: clampStr(payload.subject, 'Direito Constitucional', 2, 80),
    topic: clampStr(payload.topic, 'Tópico Geral', 2, 140),
    organ: clampStr(payload.organ, 'Órgão Público', 2, 100),
    year: Math.max(1990, Math.min(2035, Math.round(Number(payload.year) || 2025))),
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
    createdByUserId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'questions', newId), docData);
    return mapQuestionDoc(newId, { ...docData, createdAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `questions/${newId}`);
  }
}

export async function updateQuestion(
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
  const qPath = `questions/${questionId}`;
  const updates = {
    board: clampStr(payload.board, 'FGV', 2, 40),
    career: clampStr(payload.career, 'Tribunais', 2, 60),
    subject: clampStr(payload.subject, 'Direito Constitucional', 2, 80),
    topic: clampStr(payload.topic, 'Tópico Geral', 2, 140),
    organ: clampStr(payload.organ, 'Órgão Público', 2, 100),
    year: Math.max(1990, Math.min(2035, Math.round(Number(payload.year) || 2025))),
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
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'questions', questionId), updates);
    const snap = await getDoc(doc(db, 'questions', questionId));
    return mapQuestionDoc(questionId, snap.data() || updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, qPath);
  }
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const qPath = `questions/${questionId}`;
  try {
    await deleteDoc(doc(db, 'questions', questionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, qPath);
  }
}

export async function submitQuestionAttempt(
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
}> {
  const { question, selectedOption, timeSpentSec = 45, profileId, isBookmarked } =
    payload;
  const cleanOption = clampStr(selectedOption.toUpperCase(), 'A', 1, 5);
  const isCorrect = cleanOption === question.correctOption.trim().toUpperCase();
  const attemptId = makeDocId('att');
  const attemptPath = `users/${uid}/attempts/${attemptId}`;

  const docData: Record<string, any> = {
    userId: uid,
    questionId: question.id,
    subject: clampStr(question.subject, 'Geral', 2, 80),
    topic: clampStr(question.topic, 'Geral', 2, 140),
    board: clampStr(question.board, 'FGV', 2, 40),
    selectedOption: cleanOption,
    isCorrect,
    timeSpentSec: Math.max(1, Math.min(3600, Math.round(Number(timeSpentSec) || 45))),
    isBookmarked: Boolean(isBookmarked),
    createdAt: serverTimestamp(),
  };
  if (profileId && String(profileId).trim()) {
    docData.profileId = String(profileId).slice(0, 128);
  }

  try {
    await setDoc(doc(db, 'users', uid, 'attempts', attemptId), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, attemptPath);
  }

  const xpEarned = isCorrect ? 25 : 10;
  const updatedUser = await addXpAndCheckStreak(uid, xpEarned);
  await awardAchievementIfMissing(
    uid,
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

export async function commitPdfQuestionsToFirestore(
  uid: string,
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
): Promise<{
  insertedCount: number;
  user: UserProfile | null;
}> {
  const pdfId = makeDocId('pdf');
  const stamp = Date.now().toString().slice(-6);
  const cleanBoard = clampStr(payload.board, 'FGV', 2, 40);
  const cleanCareer = clampStr(payload.career, 'Tribunais', 2, 60);
  const cleanYear = Math.max(1990, Math.min(2035, Math.round(Number(payload.year) || 2025)));
  const cleanItems = payload.items.slice(0, 200);

  const batch = writeBatch(db);
  batch.set(doc(db, 'pdfImports', pdfId), {
    userId: uid,
    title: clampStr(payload.title, 'Prova Importada', 2, 160),
    fileName: clampStr(payload.fileName, 'prova.pdf', 2, 160),
    board: cleanBoard,
    career: cleanCareer,
    year: cleanYear,
    extractedCount: cleanItems.length,
    status: 'processed',
    createdAt: serverTimestamp(),
  });

  cleanItems.forEach((item, idx) => {
    const qId = makeDocId(`q_pdf_${idx}`);
    const validOpts =
      Array.isArray(item.options) && item.options.length >= 2
        ? item.options.slice(0, 5)
        : [
            { key: 'C', text: 'Certo' },
            { key: 'E', text: 'Errado' },
          ];
    batch.set(doc(db, 'questions', qId), {
      code: `PDF-${cleanBoard.slice(0, 3).toUpperCase()}-${stamp}-${idx + 1}`,
      board: cleanBoard,
      career: cleanCareer,
      subject: clampStr(item.subject, 'Conhecimentos Gerais', 2, 80),
      topic: clampStr(item.topic, 'Tópico Extraído', 2, 140),
      organ: clampStr(item.organ || payload.title, 'Prova Personalizada', 2, 100),
      year: cleanYear,
      difficulty:
        item.difficulty === 'Fácil' || item.difficulty === 'Difícil'
          ? item.difficulty
          : 'Média',
      questionType:
        item.questionType === 'true_false' ? 'true_false' : 'multiple_choice',
      statement: clampStr(item.statement, 'Enunciado extraído do PDF.', 10, 5000),
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
      pdfImportId: pdfId,
      createdByUserId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `pdfImports/${pdfId}`);
  }

  const updatedUser = await addXpAndCheckStreak(uid, 60);
  await awardAchievementIfMissing(
    uid,
    'pdf_creator',
    'Curador de Provas PDF',
    'Transformou um caderno PDF em questões comentadas no banco.'
  );

  return {
    insertedCount: cleanItems.length,
    user: updatedUser,
  };
}

export async function fetchPdfImports(uid: string, email?: string | null): Promise<PdfImportHistory[]> {
  const path = 'pdfImports';
  try {
    const isBootstrap =
      (email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
    const qRef = isBootstrap
      ? query(collection(db, path))
      : query(collection(db, path), where('userId', '==', uid));
    const snap = await getDocs(qRef);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: String(data.title || ''),
          fileName: String(data.fileName || ''),
          board: String(data.board || ''),
          career: String(data.career || ''),
          year: Number(data.year || 2025),
          extractedCount: Number(data.extractedCount || 0),
          status: String(data.status || 'processed'),
          createdAt: toIso(data.createdAt),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deletePdfImportAndQuestions(pdfId: string): Promise<void> {
  try {
    const qSnap = await getDocs(
      query(collection(db, 'questions'), where('year', '>=', 1990))
    );
    const linked = qSnap.docs.filter((d) => d.data().pdfImportId === pdfId);
    const batch = writeBatch(db);
    linked.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'pdfImports', pdfId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `pdfImports/${pdfId}`);
  }
}

export async function saveScrapedQuestionsToFirestore(
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
}> {
  const jobId = makeDocId('scr');
  const stamp = Date.now().toString().slice(-6);
  const cleanBoard = clampStr(payload.board, 'Cebraspe', 2, 40);
  const cleanCareer = clampStr(payload.career, 'Tribunais', 2, 60);
  const items = payload.questions.slice(0, 100);

  const batch = writeBatch(db);
  const createdQuestions: QuestionItem[] = [];

  items.forEach((item, idx) => {
    const qId = makeDocId(`q_scr_${idx}`);
    const validOpts =
      Array.isArray(item.options) && item.options.length >= 2
        ? item.options.slice(0, 5)
        : [
            { key: 'C', text: 'Certo' },
            { key: 'E', text: 'Errado' },
          ];
    const code = `SCR-${cleanBoard.slice(0, 3).toUpperCase()}-${stamp}-${idx + 1}`;
    const qDoc = {
      code,
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
        item.questionType === 'true_false' ? 'true_false' : 'multiple_choice',
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
      createdByUserId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(doc(db, 'questions', qId), qDoc);
    createdQuestions.push(
      mapQuestionDoc(qId, { ...qDoc, createdAt: new Date().toISOString() })
    );
  });

  const jobDoc = {
    userId: uid,
    sourceName: clampStr(payload.sourceName, 'Portal Oficial', 2, 160),
    sourceUrl: clampStr(payload.sourceUrl, 'https://www.cebraspe.org.br', 8, 500),
    board: cleanBoard,
    career: cleanCareer,
    questionsImported: items.length,
    status: 'completed',
    summary: clampStr(payload.summary, 'Coleta concluída.', 0, 600),
    ranAt: serverTimestamp(),
  };
  batch.set(doc(db, 'scrapeJobs', jobId), jobDoc);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `scrapeJobs/${jobId}`);
  }

  return {
    insertedCount: createdQuestions.length,
    questions: createdQuestions,
    job: {
      id: jobId,
      sourceName: jobDoc.sourceName,
      sourceUrl: jobDoc.sourceUrl,
      board: jobDoc.board,
      career: jobDoc.career,
      questionsImported: jobDoc.questionsImported,
      status: 'completed',
      summary: jobDoc.summary,
      ranAt: new Date().toISOString(),
    },
  };
}

export async function fetchScrapeHistory(
  uid: string,
  email?: string | null
): Promise<ScrapeJobHistory[]> {
  const path = 'scrapeJobs';
  try {
    const isBootstrap =
      (email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
    const qRef = isBootstrap
      ? query(collection(db, path))
      : query(collection(db, path), where('userId', '==', uid));
    const snap = await getDocs(qRef);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          sourceName: String(data.sourceName || ''),
          sourceUrl: String(data.sourceUrl || ''),
          board: String(data.board || ''),
          career: String(data.career || ''),
          questionsImported: Number(data.questionsImported || 0),
          status: String(data.status || 'completed'),
          summary: data.summary || null,
          ranAt: toIso(data.ranAt),
        };
      })
      .sort((a, b) => b.ranAt.localeCompare(a.ranAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAdminUsers(
  uid: string,
  email?: string | null
): Promise<AdminUserItem[]> {
  const path = 'users';
  try {
    const isBootstrap =
      (email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
    const qRef = isBootstrap
      ? query(collection(db, path))
      : query(collection(db, path), where('uid', '==', uid));
    const snap = await getDocs(qRef);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          email: String(data.email || ''),
          displayName: data.displayName || null,
          role: (data.role as UserRole) || 'user',
          xp: Number(data.xp || 0),
          level: Number(data.level || 1),
          streakDays: Number(data.streakDays || 1),
          createdAt: toIso(data.createdAt),
        };
      })
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateUserRoleByAdmin(
  targetUid: string,
  nextRole: UserRole,
  currentAdminList: AdminUserItem[]
): Promise<AdminUserItem> {
  const target = currentAdminList.find((u) => u.id === targetUid);
  if (target?.role === 'admin' && nextRole !== 'admin') {
    const adminCount = currentAdminList.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      throw new Error(
        'Não é possível remover o último administrador ativo do sistema.'
      );
    }
  }

  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role: nextRole,
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(doc(db, 'users', targetUid));
    const data = snap.data() || {};
    return {
      id: targetUid,
      email: String(data.email || ''),
      displayName: data.displayName || null,
      role: (data.role as UserRole) || nextRole,
      xp: Number(data.xp || 0),
      level: Number(data.level || 1),
      streakDays: Number(data.streakDays || 1),
      createdAt: toIso(data.createdAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchMockExamsAndRankings(uid: string): Promise<{
  myExams: MockExamRecord[];
  rankings: RankingEntry[];
}> {
  try {
    const [examSnap, rankSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'users', uid, 'mockExams'),
          where('userId', '==', uid)
        )
      ),
      getDocs(query(collection(db, 'rankings'), where('xp', '>=', 0))),
    ]);

    const myExams: MockExamRecord[] = examSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: String(data.title || ''),
          board: String(data.board || ''),
          career: String(data.career || ''),
          durationMinutes: Number(data.durationMinutes || 20),
          elapsedSeconds: Number(data.elapsedSeconds || 0),
          totalQuestions: Number(data.totalQuestions || 0),
          correctCount: Number(data.correctCount || 0),
          wrongCount: Number(data.wrongCount || 0),
          blankCount: Number(data.blankCount || 0),
          netScore: Number(data.netScore || 0),
          breakdownJson: Array.isArray(data.breakdownJson)
            ? data.breakdownJson
            : null,
          createdAt: toIso(data.createdAt),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const rankings: RankingEntry[] = rankSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          userId: d.id,
          displayName: data.displayName || null,
          xp: Number(data.xp || 0),
          level: Number(data.level || 1),
          streakDays: Number(data.streakDays || 1),
          bestScore: Number(data.bestScore || 0),
          examsCount: Number(data.examsCount || 0),
        };
      })
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 20);

    return { myExams, rankings };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${uid}/mockExams`);
  }
}

export async function submitMockExamToFirestore(
  uid: string,
  payload: {
    title: string;
    board: string;
    career: string;
    durationMinutes: number;
    elapsedSeconds: number;
    cebraspePenalty: boolean;
    questions: QuestionItem[];
    answers: Record<string, string>;
  }
): Promise<{
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
}> {
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

  const batch = writeBatch(db);
  const perQSec = Math.max(
    15,
    Math.min(
      3600,
      Math.round(
        (Number(payload.elapsedSeconds) || 300) /
          Math.max(1, payload.questions.length)
      )
    )
  );

  payload.questions.forEach((q, idx) => {
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
      const attId = makeDocId(`att_sim_${idx}`);
      batch.set(doc(db, 'users', uid, 'attempts', attId), {
        userId: uid,
        questionId: q.id,
        subject: clampStr(q.subject, 'Geral', 2, 80),
        topic: clampStr(q.topic, 'Geral', 2, 140),
        board: clampStr(q.board, 'FGV', 2, 40),
        selectedOption: clampStr(sel, 'A', 1, 5),
        isCorrect,
        timeSpentSec: perQSec,
        isBookmarked: !isCorrect,
        createdAt: serverTimestamp(),
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
  });

  const rawNet = payload.cebraspePenalty
    ? Math.max(0, correctCount - wrongCount)
    : correctCount;
  const netScore =
    payload.questions.length > 0
      ? Math.round((rawNet / payload.questions.length) * 100)
      : 0;

  const breakdownJson = Array.from(subjectMap.entries()).map(
    ([subject, val]) => ({
      subject,
      total: val.total,
      correct: val.correct,
    })
  );

  const examId = makeDocId('exam');
  const examDoc = {
    userId: uid,
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
    totalQuestions: payload.questions.length,
    correctCount,
    wrongCount,
    blankCount,
    netScore,
    status: 'completed',
    breakdownJson:
      breakdownJson.length > 0
        ? breakdownJson.slice(0, 30)
        : [{ subject: 'Geral', total: payload.questions.length, correct: correctCount }],
    createdAt: serverTimestamp(),
  };

  batch.set(doc(db, 'users', uid, 'mockExams', examId), examDoc);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `users/${uid}/mockExams/${examId}`
    );
  }

  const updatedUser = await addXpAndCheckStreak(uid, 100, {
    bestScore: netScore,
    examsIncrement: 1,
  });
  await awardAchievementIfMissing(
    uid,
    'simulado_finisher',
    'Maratonista de Simulado',
    'Concluiu um simulado cronometrado completo com diagnóstico.'
  );

  return {
    exam: {
      id: examId,
      title: examDoc.title,
      board: examDoc.board,
      career: examDoc.career,
      durationMinutes: examDoc.durationMinutes,
      elapsedSeconds: examDoc.elapsedSeconds,
      totalQuestions: examDoc.totalQuestions,
      correctCount,
      wrongCount,
      blankCount,
      netScore,
      breakdownJson: examDoc.breakdownJson,
      createdAt: new Date().toISOString(),
    },
    detailedResults,
    user: updatedUser,
  };
}

export async function fetchAnalyticsFromFirestore(uid: string): Promise<{
  subjectStats: SubjectStat[];
  recentErrors: { subject: string; topic: string; board: string }[];
}> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'users', uid, 'attempts'),
        where('userId', '==', uid)
      )
    );
    const subjectBuckets = new Map<
      string,
      { total: number; correct: number; totalSec: number }
    >();
    const allAttempts = snap.docs
      .map((d) => ({
        subject: String(d.data().subject || 'Geral'),
        topic: String(d.data().topic || 'Geral'),
        board: String(d.data().board || 'FGV'),
        isCorrect: Boolean(d.data().isCorrect),
        timeSpentSec: Number(d.data().timeSpentSec || 40),
        createdAt: toIso(d.data().createdAt),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    for (const att of allAttempts) {
      const b = subjectBuckets.get(att.subject) || {
        total: 0,
        correct: 0,
        totalSec: 0,
      };
      b.total += 1;
      if (att.isCorrect) b.correct += 1;
      b.totalSec += att.timeSpentSec;
      subjectBuckets.set(att.subject, b);
    }

    const subjectStats: SubjectStat[] = Array.from(subjectBuckets.entries()).map(
      ([subject, b]) => ({
        subject,
        total: b.total,
        correct: b.correct,
        avgSeconds: Math.round(b.totalSec / Math.max(1, b.total)),
      })
    );

    const recentErrors = allAttempts
      .filter((a) => !a.isCorrect)
      .slice(0, 12)
      .map((a) => ({
        subject: a.subject,
        topic: a.topic,
        board: a.board,
      }));

    return { subjectStats, recentErrors };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${uid}/attempts`);
  }
}

export async function fetchSchedules(uid: string): Promise<StudyScheduleItem[]> {
  const path = `users/${uid}/schedules`;
  try {
    const snap = await getDocs(
      query(collection(db, path), where('userId', '==', uid))
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          dayOfWeek: Number(data.dayOfWeek ?? 1),
          startTime: String(data.startTime || '19:00'),
          durationMinutes: Number(data.durationMinutes || 90),
          subject: String(data.subject || ''),
          focusType: String(data.focusType || 'Questões'),
          completed: Boolean(data.completed),
          calendarEventId: data.calendarEventId || null,
        };
      })
      .sort(
        (a, b) =>
          a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)
      );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createScheduleItem(
  uid: string,
  payload: {
    dayOfWeek: number;
    startTime: string;
    durationMinutes: number;
    subject: string;
    focusType: string;
  }
): Promise<StudyScheduleItem> {
  const schedId = makeDocId('sched');
  const path = `users/${uid}/schedules/${schedId}`;
  const docData = {
    userId: uid,
    dayOfWeek: Math.max(0, Math.min(6, Math.round(Number(payload.dayOfWeek) || 0))),
    startTime: clampStr(payload.startTime, '19:00', 4, 10),
    durationMinutes: Math.max(
      10,
      Math.min(480, Math.round(Number(payload.durationMinutes) || 90))
    ),
    subject: clampStr(payload.subject, 'Disciplina', 2, 100),
    focusType: clampStr(payload.focusType, 'Questões', 2, 40),
    completed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid, 'schedules', schedId), docData);
    return {
      id: schedId,
      dayOfWeek: docData.dayOfWeek,
      startTime: docData.startTime,
      durationMinutes: docData.durationMinutes,
      subject: docData.subject,
      focusType: docData.focusType,
      completed: false,
      calendarEventId: null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateScheduleItem(
  uid: string,
  scheduleId: string,
  updates: { completed?: boolean; calendarEventId?: string }
): Promise<StudyScheduleItem> {
  const path = `users/${uid}/schedules/${scheduleId}`;
  const cleanUpdates: Record<string, any> = { updatedAt: serverTimestamp() };
  if (typeof updates.completed === 'boolean') {
    cleanUpdates.completed = updates.completed;
  }
  if (typeof updates.calendarEventId === 'string' && updates.calendarEventId) {
    cleanUpdates.calendarEventId = updates.calendarEventId.slice(0, 256);
  }

  try {
    await updateDoc(doc(db, 'users', uid, 'schedules', scheduleId), cleanUpdates);
    const snap = await getDoc(doc(db, 'users', uid, 'schedules', scheduleId));
    const data = snap.data() || {};
    return {
      id: scheduleId,
      dayOfWeek: Number(data.dayOfWeek ?? 1),
      startTime: String(data.startTime || '19:00'),
      durationMinutes: Number(data.durationMinutes || 90),
      subject: String(data.subject || ''),
      focusType: String(data.focusType || 'Questões'),
      completed: Boolean(data.completed),
      calendarEventId: data.calendarEventId || null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteScheduleItem(uid: string, scheduleId: string): Promise<void> {
  const path = `users/${uid}/schedules/${scheduleId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'schedules', scheduleId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function exportUserBackupFromFirestore(user: UserProfile) {
  const uid = user.uid;
  const [profSnap, schedSnap, examSnap] = await Promise.all([
    getDocs(
      query(collection(db, 'users', uid, 'profiles'), where('userId', '==', uid))
    ),
    getDocs(
      query(collection(db, 'users', uid, 'schedules'), where('userId', '==', uid))
    ),
    getDocs(
      query(collection(db, 'users', uid, 'mockExams'), where('userId', '==', uid))
    ),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    platform: 'AprovaFoco',
    user: {
      email: user.email,
      displayName: user.displayName,
      xp: user.xp,
      level: user.level,
      streakDays: user.streakDays,
    },
    profiles: profSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    schedules: schedSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    mockExams: examSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

export async function fetchForumPosts(): Promise<ForumPostItem[]> {
  const path = 'forumPosts';
  try {
    const snap = await getDocs(
      query(collection(db, path), where('upvotes', '>=', 0))
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          questionId: data.questionId || null,
          subject: String(data.subject || ''),
          title: String(data.title || ''),
          body: String(data.body || ''),
          authorName: String(data.authorName || 'Estudante'),
          upvotes: Number(data.upvotes || 1),
          repliesJson: Array.isArray(data.repliesJson) ? data.repliesJson : [],
          createdAt: toIso(data.createdAt),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 40);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createForumPost(
  user: UserProfile,
  payload: {
    title: string;
    body: string;
    subject: string;
    questionId?: string | null;
  }
): Promise<ForumPostItem> {
  const postId = makeDocId('post');
  const path = `forumPosts/${postId}`;
  const authorName = clampStr(
    user.displayName || user.email.split('@')[0],
    'Estudante',
    1,
    60
  );
  const docData: Record<string, any> = {
    userId: user.uid,
    subject: clampStr(payload.subject, 'Direito Constitucional', 2, 80),
    title: clampStr(payload.title, 'Dúvida de estudo', 3, 140),
    body: clampStr(payload.body, 'Descrição da dúvida.', 3, 3000),
    authorName,
    upvotes: 1,
    repliesJson: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (payload.questionId && String(payload.questionId).trim()) {
    docData.questionId = String(payload.questionId).slice(0, 128);
  }

  try {
    await setDoc(doc(db, 'forumPosts', postId), docData);
    return {
      id: postId,
      questionId: docData.questionId || null,
      subject: docData.subject,
      title: docData.title,
      body: docData.body,
      authorName,
      upvotes: 1,
      repliesJson: [],
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function replyForumPost(
  postId: string,
  user: UserProfile,
  text: string
): Promise<ForumPostItem> {
  const path = `forumPosts/${postId}`;
  try {
    const snap = await getDoc(doc(db, 'forumPosts', postId));
    if (!snap.exists()) {
      throw new Error('Tópico não encontrado.');
    }
    const existing = snap.data();
    const author = clampStr(
      user.displayName || user.email.split('@')[0],
      'Estudante',
      1,
      60
    );
    const updatedReplies = [
      ...(Array.isArray(existing.repliesJson) ? existing.repliesJson : []),
      {
        id: `${Date.now()}`,
        author,
        text: text.trim().slice(0, 1200),
        createdAt: new Date().toISOString(),
      },
    ];
    await updateDoc(doc(db, 'forumPosts', postId), {
      repliesJson: updatedReplies,
      updatedAt: serverTimestamp(),
    });
    return {
      id: postId,
      questionId: existing.questionId || null,
      subject: String(existing.subject || ''),
      title: String(existing.title || ''),
      body: String(existing.body || ''),
      authorName: String(existing.authorName || 'Estudante'),
      upvotes: Number(existing.upvotes || 1),
      repliesJson: updatedReplies,
      createdAt: toIso(existing.createdAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upvoteForumPost(postId: string): Promise<ForumPostItem> {
  const path = `forumPosts/${postId}`;
  try {
    const snap = await getDoc(doc(db, 'forumPosts', postId));
    if (!snap.exists()) {
      throw new Error('Tópico não encontrado.');
    }
    const existing = snap.data();
    const nextUpvotes = Number(existing.upvotes || 0) + 1;
    await updateDoc(doc(db, 'forumPosts', postId), {
      upvotes: nextUpvotes,
      updatedAt: serverTimestamp(),
    });
    return {
      id: postId,
      questionId: existing.questionId || null,
      subject: String(existing.subject || ''),
      title: String(existing.title || ''),
      body: String(existing.body || ''),
      authorName: String(existing.authorName || 'Estudante'),
      upvotes: nextUpvotes,
      repliesJson: Array.isArray(existing.repliesJson) ? existing.repliesJson : [],
      createdAt: toIso(existing.createdAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchChatHistory(room: string): Promise<ChatMessageItem[]> {
  const path = 'chatMessages';
  try {
    const snap = await getDocs(
      query(collection(db, path), where('room', '==', room))
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          room: String(data.room || room),
          authorName: String(data.authorName || 'Estudante'),
          authorLevel: Number(data.authorLevel || 1),
          message: String(data.message || ''),
          createdAt: toIso(data.createdAt),
        };
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-50);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveChatMessage(
  user: UserProfile,
  room: string,
  message: string
): Promise<ChatMessageItem> {
  const msgId = makeDocId('msg');
  const path = `chatMessages/${msgId}`;
  const authorName = clampStr(
    user.displayName || user.email.split('@')[0],
    'Estudante',
    1,
    60
  );
  const cleanMsg = clampStr(message, 'Mensagem', 1, 800);
  const docData = {
    userId: user.uid,
    room,
    authorName,
    authorLevel: Math.max(1, Math.min(1000, user.level || 1)),
    message: cleanMsg,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'chatMessages', msgId), docData);
    return {
      id: msgId,
      room,
      authorName,
      authorLevel: docData.authorLevel,
      message: cleanMsg,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
