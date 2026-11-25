/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Timer,
  UserCircle2,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { AccountModal } from './components/AccountModal';
import { CommunityView } from './components/CommunityView';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MockExamsView } from './components/MockExamsView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PdfAndScraperView } from './components/PdfAndScraperView';
import { QuestionBankView } from './components/QuestionBankView';
import { SignInScreen } from './components/SignInScreen';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { initAuthListener } from './lib/firebase';
import {
  fetchOfflinePackQuestions,
  submitQuestionAttempt,
  syncCurrentUserAndWorkspace,
  updateMyPreferences,
} from './lib/firestoreDb';
import {
  clearPendingAttempts,
  getPendingAttempts,
  loadOfflineQuestions,
} from './lib/offlineDb';
import type {
  AchievementBadge,
  QuestionItem,
  StudyGoalProfile,
  UserProfile,
  UserRole,
} from './types';

type ActiveSection = 'questions' | 'pdfs' | 'dashboard' | 'exams' | 'community';

function AppShell() {
  const isOnline = useOnlineStatus();
  const [authChecked, setAuthChecked] = useState(false);
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [section, setSection] = useState<ActiveSection>('questions');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<StudyGoalProfile[]>([]);
  const [achievements, setAchievements] = useState<AchievementBadge[]>([]);
  const [summary, setSummary] = useState({
    totalAttempts: 0,
    correctAttempts: 0,
    totalBankQuestions: 0,
  });

  const [accountOpen, setAccountOpen] = useState(false);
  const [linkedForumQuestion, setLinkedForumQuestion] =
    useState<QuestionItem | null>(null);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [rankingRefreshSignal, setRankingRefreshSignal] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const unsub = initAuthListener(
      (user) => {
        setFbUser(user);
        setAuthChecked(true);
      },
      () => {
        setFbUser(null);
        setUserProfile(null);
        setAuthChecked(true);
      }
    );
    return () => unsub();
  }, []);

  const loadAccountState = useCallback(async () => {
    if (!fbUser) return;
    try {
      const data = await syncCurrentUserAndWorkspace(fbUser);
      setUserProfile(data.user);
      setProfiles(data.profiles);
      setAchievements(data.achievements);
      setSummary(data.summary);
      if (
        data.user.preferredTheme === 'dark' ||
        data.user.preferredTheme === 'light'
      ) {
        setTheme(data.user.preferredTheme);
      }
    } catch (err) {
      console.error('Failed to sync workspace:', err);
    }
  }, [fbUser]);

  useEffect(() => {
    loadAccountState();
  }, [loadAccountState]);

  const refreshPendingOfflineCount = useCallback(async () => {
    const pending = await getPendingAttempts().catch(() => []);
    setPendingOfflineCount(pending.length);
  }, []);

  useEffect(() => {
    refreshPendingOfflineCount();
  }, [refreshPendingOfflineCount]);

  const syncOfflineAttemptsNow = useCallback(async () => {
    if (!isOnline || !fbUser) return;
    const pending = await getPendingAttempts().catch(() => []);
    if (pending.length === 0) return;

    setIsSyncingOffline(true);
    try {
      const cached = await loadOfflineQuestions().catch(() => []);
      const cloudPack =
        cached.length > 0 ? cached : await fetchOfflinePackQuestions().catch(() => []);
      const qMap = new Map(cloudPack.map((q) => [q.id, q]));

      for (const att of pending) {
        const question = qMap.get(att.questionId);
        if (question) {
          await submitQuestionAttempt(fbUser.uid, {
            question,
            selectedOption: att.selectedOption,
            timeSpentSec: att.timeSpentSec,
          });
        }
      }
      await clearPendingAttempts();
      setPendingOfflineCount(0);
      await loadAccountState();
    } finally {
      setIsSyncingOffline(false);
    }
  }, [isOnline, fbUser, loadAccountState]);

  useEffect(() => {
    if (isOnline && fbUser && pendingOfflineCount > 0) {
      syncOfflineAttemptsNow();
    }
  }, [isOnline, fbUser, pendingOfflineCount, syncOfflineAttemptsNow]);

  const handleToggleTheme = async () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (fbUser) {
      updateMyPreferences(fbUser.uid, { preferredTheme: nextTheme }).catch(
        () => {}
      );
    }
  };

  const userRole: UserRole = userProfile?.role || 'user';
  const canAccessEditorial = userRole === 'admin' || userRole === 'editor';

  useEffect(() => {
    if (section === 'pdfs' && !canAccessEditorial) {
      setSection('questions');
    }
  }, [section, canAccessEditorial]);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1120] text-slate-600 dark:text-slate-300 text-sm">
        Carregando plataforma...
      </div>
    );
  }

  if (!fbUser) {
    return (
      <SignInScreen
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onSuccess={loadAccountState}
      />
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1120] text-slate-600 dark:text-slate-300 text-sm">
        Sincronizando perfil e banco de questões...
      </div>
    );
  }

  const activeProfile =
    profiles.find((p) => p.isActive) || profiles[0] || null;

  const navItems: {
    id: ActiveSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'questions', label: 'Questões', icon: BookOpen },
    ...(canAccessEditorial
      ? [
          {
            id: 'pdfs' as ActiveSection,
            label: userRole === 'admin' ? 'Admin & Coletas' : 'Editorial PDFs',
            icon: FileText,
          },
        ]
      : []),
    { id: 'dashboard', label: 'Painel IA', icon: LayoutDashboard },
    { id: 'exams', label: 'Simulados', icon: Timer },
    { id: 'community', label: 'Comunidade', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 pb-20 lg:pb-10">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setSection('questions')}
            className="text-lg font-bold tracking-tight font-display text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            AprovaFoco
          </button>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  section === item.id
                    ? 'border-blue-600 text-slate-900 dark:text-white font-semibold'
                    : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserCircle2 className="w-4 h-4" />
            <span>
              Nível {userProfile.level} · {userProfile.xp} XP
            </span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {section === 'questions' && (
          <QuestionBankView
            currentUser={userProfile}
            activeProfileId={activeProfile?.id || null}
            onUserUpdated={(u) => {
              setUserProfile(u);
              loadAccountState();
            }}
            onPendingOfflineChange={refreshPendingOfflineCount}
            onOpenForumForQuestion={(q) => {
              setLinkedForumQuestion(q);
              setSection('community');
            }}
            onQuestionsMutated={loadAccountState}
          />
        )}

        {section === 'pdfs' && canAccessEditorial && (
          <PdfAndScraperView
            user={userProfile}
            onUserUpdated={(u) => {
              setUserProfile(u);
              loadAccountState();
            }}
            onQuestionsAdded={loadAccountState}
          />
        )}

        {section === 'dashboard' && (
          <DashboardView
            user={userProfile}
            activeProfile={activeProfile}
            achievements={achievements}
            summary={summary}
            onUserUpdated={setUserProfile}
            onNavigateQuestions={() => setSection('questions')}
          />
        )}

        {section === 'exams' && (
          <MockExamsView
            user={userProfile}
            onUserUpdated={(u) => {
              setUserProfile(u);
              setRankingRefreshSignal((s) => s + 1);
              loadAccountState();
            }}
            rankingRefreshSignal={rankingRefreshSignal}
          />
        )}

        {section === 'community' && (
          <CommunityView
            user={userProfile}
            linkedQuestion={linkedForumQuestion}
            onClearLinkedQuestion={() => setLinkedForumQuestion(null)}
          />
        )}
      </main>

      {/* Tablet & Mobile Bottom Thumb Navigation (<= 15% height) */}
      <nav
        aria-label="Navegação principal móvel"
        className={`lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-2 py-1.5 grid ${
          navItems.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
        } gap-1`}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                active
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <OfflineIndicator
        pendingCount={pendingOfflineCount}
        onSyncNow={syncOfflineAttemptsNow}
        isSyncing={isSyncingOffline}
      />

      <AccountModal
        open={accountOpen}
        user={userProfile}
        profiles={profiles}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onUserUpdated={setUserProfile}
        onProfilesChanged={loadAccountState}
        onClose={() => setAccountOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
