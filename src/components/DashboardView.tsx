import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Bell,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  CloudUpload,
  Flame,
  Loader2,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { getAuthProvider, getRepositories } from '../repositories';
import {
  syncScheduleToGoogleCalendar,
  uploadBackupToGoogleDrive,
} from '../lib/workspace';
import type {
  AchievementBadge,
  AdaptiveDiagnosis,
  StudyGoalProfile,
  StudyScheduleItem,
  SubjectStat,
  UserProfile,
} from '../types';
import { ConfirmDialog } from './ConfirmDialog';

interface DashboardViewProps {
  user: UserProfile;
  activeProfile: StudyGoalProfile | null;
  achievements: AchievementBadge[];
  summary: {
    totalAttempts: number;
    correctAttempts: number;
    totalBankQuestions: number;
  };
  onUserUpdated: (user: UserProfile) => void;
  onNavigateQuestions: () => void;
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  activeProfile,
  achievements,
  summary,
  onUserUpdated,
  onNavigateQuestions,
}) => {
  const repos = getRepositories();
  const authProvider = getAuthProvider();
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [schedules, setSchedules] = useState<StudyScheduleItem[]>([]);
  const [diagnosis, setDiagnosis] = useState<AdaptiveDiagnosis | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [emblemFailed, setEmblemFailed] = useState(false);

  const [newDay, setNewDay] = useState(1);
  const [newTime, setNewTime] = useState('19:30');
  const [newSubject, setNewSubject] = useState('Direito Constitucional');
  const [newFocus, setNewFocus] = useState('Questões');

  const [calendarConfirmItem, setCalendarConfirmItem] =
    useState<StudyScheduleItem | null>(null);
  const [driveConfirmOpen, setDriveConfirmOpen] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      const [analyticsRes, schedRes] = await Promise.all([
        repos.dashboard.getAnalytics(user.uid),
        repos.dashboard.listSchedules(user.uid),
      ]);
      setSubjectStats(analyticsRes.subjectStats);
      setSchedules(schedRes);
    } catch {
      // Keep UI interactive if offline
    }
  }, [repos, user.uid]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleGenerateAiPlan = async () => {
    setLoadingAi(true);
    setError(null);
    try {
      const analytics = await repos.dashboard.getAnalytics(user.uid);
      const res = await apiFetch<{ diagnosis: AdaptiveDiagnosis }>(
        '/api/ai/adaptive-plan',
        {
          method: 'POST',
          body: JSON.stringify({
            profileName: activeProfile?.name || 'Preparação Geral',
            career: activeProfile?.career || 'Tribunais',
            targetBoard: activeProfile?.targetBoard || 'FGV',
            subjectStats: analytics.subjectStats,
            recentErrors: analytics.recentErrors,
          }),
        }
      );
      setDiagnosis(res.diagnosis);
    } catch (err: any) {
      setError(
        err?.message || 'Não foi possível gerar o diagnóstico adaptativo.'
      );
    } finally {
      setLoadingAi(false);
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await repos.dashboard.createSchedule(user.uid, {
        dayOfWeek: newDay,
        startTime: newTime,
        durationMinutes: 90,
        subject: newSubject,
        focusType: newFocus,
      });
      setSchedules((prev) => [...prev, created]);
      setNotice('Sessão adicionada ao seu cronograma.');
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar sessão.');
    }
  };

  const handleAddRecommendedBlock = async (block: {
    subject: string;
    focusType: string;
    durationMinutes: number;
  }) => {
    try {
      const created = await repos.dashboard.createSchedule(user.uid, {
        dayOfWeek: new Date().getDay(),
        startTime: '20:00',
        durationMinutes: block.durationMinutes,
        subject: block.subject,
        focusType: block.focusType,
      });
      setSchedules((prev) => [...prev, created]);
      setNotice(`Bloco "${block.subject}" incorporado ao cronograma.`);
    } catch (err: any) {
      setError(err?.message || 'Erro ao adicionar recomendação.');
    }
  };

  const handleToggleSchedule = async (item: StudyScheduleItem) => {
    try {
      const updated = await repos.dashboard.updateSchedule(user.uid, item.id, {
        completed: !item.completed,
      });
      setSchedules((prev) =>
        prev.map((s) => (s.id === item.id ? updated : s))
      );
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar bloco.');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await repos.dashboard.deleteSchedule(user.uid, id);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir bloco.');
    }
  };

  const ensureWorkspaceToken = async (): Promise<string> => {
    if (!authProvider.supportsGoogleWorkspace) {
      throw new Error(
        'A sincronização com Google Workspace está disponível apenas no modo Google/Firebase.'
      );
    }
    const existing = authProvider.getWorkspaceAccessToken();
    if (existing) return existing;
    const res = await authProvider.signInWithGoogle();
    if (!res.workspaceToken) {
      throw new Error(
        'Permissão do Google Calendar/Drive não retornada. Tente novamente.'
      );
    }
    return res.workspaceToken;
  };

  const handleConfirmCalendarSync = async () => {
    if (!calendarConfirmItem) return;
    setWorkspaceBusy(true);
    setError(null);
    try {
      const token = await ensureWorkspaceToken();
      const { eventId } = await syncScheduleToGoogleCalendar(
        token,
        calendarConfirmItem
      );
      const updated = await repos.dashboard.updateSchedule(
        user.uid,
        calendarConfirmItem.id,
        { calendarEventId: eventId }
      );
      setSchedules((prev) =>
        prev.map((s) => (s.id === calendarConfirmItem.id ? updated : s))
      );
      setNotice(
        `Sessão "${calendarConfirmItem.subject}" criada no seu Google Calendar com lembrete de 15 minutos.`
      );
      setCalendarConfirmItem(null);
    } catch (err: any) {
      setError(err?.message || 'Falha ao sincronizar com Google Calendar.');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleConfirmDriveBackup = async () => {
    setWorkspaceBusy(true);
    setError(null);
    try {
      const backupPayload = await repos.dashboard.exportBackup(user);
      const token = await ensureWorkspaceToken();
      const uploaded = await uploadBackupToGoogleDrive(token, backupPayload);
      setNotice(`Backup salvo no seu Google Drive: ${uploaded.name}`);
      setDriveConfirmOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar backup para o Google Drive.');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleDownloadLocalBackup = async () => {
    setWorkspaceBusy(true);
    setError(null);
    try {
      const backupPayload = await repos.dashboard.exportBackup(user);
      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aprovafoco-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice('Backup JSON exportado localmente com sucesso.');
    } catch (err: any) {
      setError(err?.message || 'Falha ao exportar backup JSON.');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleEnablePush = async () => {
    if (!('Notification' in window)) {
      setError('Este navegador não suporta notificações locais.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      setError('Permissão de notificações recusada no navegador.');
      return;
    }
    try {
      const updatedUser = await repos.users.updatePreferences(user.uid, {
        pushEnabled: true,
      });
      onUserUpdated(updatedUser);
      new Notification('AprovaFoco — Lembretes Diários Ativos', {
        body: `Meta diária configurada: ${user.dailyGoal} questões. Vamos manter sua ofensiva de ${user.streakDays} dia(s)!`,
      });
      setNotice('Lembretes diários ativados com sucesso.');
    } catch (err: any) {
      setError(err?.message || 'Erro ao ativar notificações.');
    }
  };

  const accuracyPct =
    summary.totalAttempts > 0
      ? Math.round((summary.correctAttempts / summary.totalAttempts) * 100)
      : 0;
  const levelProgress = Math.round(((user.xp % 250) / 250) * 100);

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={Boolean(calendarConfirmItem)}
        title="Adicionar sessão ao Google Calendar?"
        description={
          calendarConfirmItem
            ? `Isso criará o evento "AprovaFoco: ${calendarConfirmItem.subject}" (${calendarConfirmItem.durationMinutes} min às ${calendarConfirmItem.startTime}) no seu Google Calendar principal com sua permissão.`
            : ''
        }
        confirmLabel="Criar no Google Calendar"
        isBusy={workspaceBusy}
        onConfirm={handleConfirmCalendarSync}
        onCancel={() => setCalendarConfirmItem(null)}
      />

      <ConfirmDialog
        open={driveConfirmOpen}
        title="Salvar backup no Google Drive?"
        description="Um arquivo JSON com seus perfis de estudo, cronograma semanal, histórico de simulados e cadernos PDF importados será enviado para o seu Google Drive."
        confirmLabel="Enviar para o Drive"
        isBusy={workspaceBusy}
        onConfirm={handleConfirmDriveBackup}
        onCancel={() => setDriveConfirmOpen(false)}
      />

      {/* Hero Progress & Gamification Banner */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0">
              {!emblemFailed ? (
                <img
                  src="/src/assets/images/mastery_trophy_emblem_1795627317405.jpg"
                  alt="Emblema de maestria do estudante"
                  referrerPolicy="no-referrer"
                  onError={() => setEmblemFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-blue-600">
                  <Award className="w-8 h-8" />
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Edital ativo: {activeProfile?.name || 'Preparação Geral'}
                </span>
                <span aria-hidden="true">·</span>
                <span>Banca {activeProfile?.targetBoard || 'Mista'}</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Olá, {user.displayName || user.email.split('@')[0]}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-mono-num">
                <span className="inline-flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                  <TrendingUp className="w-3.5 h-3.5" /> Nível {user.level} · {user.xp} XP
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                  <Flame className="w-3.5 h-3.5" /> {user.streakDays} dia(s) de ofensiva
                </span>
              </div>
            </div>
          </div>

          <div className="lg:w-80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono-num text-slate-600 dark:text-slate-300">
              <span>Progresso para Nível {user.level + 1}</span>
              <span>{levelProgress}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-300"
                style={{ width: `${Math.max(8, levelProgress)}%` }}
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={onNavigateQuestions}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Praticar questões agora →
              </button>
              <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                Meta: {user.dailyGoal}/dia
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Questões no Banco
            </p>
            <p className="mt-1 text-2xl font-bold font-mono-num text-slate-900 dark:text-white">
              {summary.totalBankQuestions}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Resolvidas por Você
            </p>
            <p className="mt-1 text-2xl font-bold font-mono-num text-slate-900 dark:text-white">
              {summary.totalAttempts}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Taxa de Acerto Geral
            </p>
            <p className="mt-1 text-2xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
              {accuracyPct}%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Conquistas Desbloqueadas
            </p>
            <p className="mt-1 text-2xl font-bold font-mono-num text-amber-600 dark:text-amber-400">
              {achievements.length}
            </p>
          </div>
        </div>
      </section>

      {notice && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Performance by Subject */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Desempenho por Disciplina
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
              Dados em tempo real
            </span>
          </div>

          {subjectStats.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Resolva suas primeiras questões no banco para visualizar o gráfico detalhado por matéria.
              </p>
              <button
                type="button"
                onClick={onNavigateQuestions}
                className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                Ir para Banco de Questões
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {subjectStats.map((st) => {
                const pct =
                  st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0;
                return (
                  <div key={st.subject}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {st.subject}
                      </span>
                      <span className="text-xs font-mono-num text-slate-600 dark:text-slate-300">
                        {st.correct}/{st.total} · {pct}% · {st.avgSeconds}s/q
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 75
                            ? 'bg-emerald-500'
                            : pct >= 50
                            ? 'bg-blue-600'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {achievements.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                Medalhas Conquistadas
              </h3>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {achievements.map((ach) => (
                  <div
                    key={ach.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {ach.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {ach.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Adaptive AI Advisor */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Inteligência Adaptativa por Edital
              </h2>
            </div>

            <button
              type="button"
              onClick={handleGenerateAiPlan}
              disabled={loadingAi}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {loadingAi && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loadingAi ? 'Diagnosticando...' : 'Gerar Diagnóstico IA'}
            </button>
          </div>

          {!diagnosis ? (
            <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Clique em <strong>Gerar Diagnóstico IA</strong> para cruzar seus acertos, tempo médio e erros recentes do seu histórico com o edital{' '}
              <strong>{activeProfile?.name || 'ativo'}</strong>, identificando lacunas prioritárias e revisões estratégicas.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 p-4">
                <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {diagnosis.summary}
                </p>
                <div className="text-right shrink-0 pl-3 border-l border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Prontidão
                  </p>
                  <p className="text-2xl font-bold font-mono-num text-blue-600 dark:text-blue-400">
                    {diagnosis.readinessScore}%
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Pontos Críticos e Ações Recomendadas
                </h3>
                {diagnosis.weakTopics.map((wt, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {wt.subject} · {wt.topic}
                      </span>
                      <span
                        className={`font-mono-num font-semibold ${
                          wt.priority === 'Alta'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        Prioridade {wt.priority} ({wt.accuracy}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {wt.recommendation}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Blocos de Revisão Sugeridos
                </h3>
                {diagnosis.recommendedBlocks.map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {b.subject} · {b.focusType} ({b.durationMinutes} min)
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {b.reason}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddRecommendedBlock(b)}
                      className="rounded-md bg-slate-900 dark:bg-blue-600 px-2.5 py-1.5 font-semibold text-white whitespace-nowrap cursor-pointer"
                    >
                      + Agendar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Personalized Schedule + Google Calendar + Google Drive + Push */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Cronograma Semanal, Agenda Google & Backup em Nuvem
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Organize seus blocos de estudo, envie lembretes para o Google Calendar e proteja seu histórico no Google Drive.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleEnablePush}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              {user.pushEnabled ? 'Notificações Ativas' : 'Ativar Lembretes Push'}
            </button>

            {authProvider.supportsGoogleWorkspace ? (
              <button
                type="button"
                onClick={() => setDriveConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <CloudUpload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Backup no Google Drive
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadLocalBackup}
                disabled={workspaceBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                <CloudUpload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Exportar Backup JSON
              </button>
            )}
          </div>
        </div>

        <form
          onSubmit={handleAddSchedule}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2.5"
        >
          <select
            value={newDay}
            onChange={(e) => setNewDay(Number(e.target.value))}
            className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
          >
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono-num"
          />
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="Disciplina"
            className="sm:col-span-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
          />
          <select
            value={newFocus}
            onChange={(e) => setNewFocus(e.target.value)}
            className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="Questões">Questões</option>
            <option value="Revisão IA">Revisão IA</option>
            <option value="Teoria PDF">Teoria PDF</option>
            <option value="Simulado">Simulado</option>
          </select>
          <button
            type="submit"
            className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </form>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {schedules.map((item) => (
            <div
              key={item.id}
              className="py-3 flex flex-wrap items-center justify-between gap-3"
            >
              <button
                type="button"
                onClick={() => handleToggleSchedule(item)}
                className="flex items-center gap-3 text-left cursor-pointer min-h-[40px]"
              >
                <CheckCircle2
                  className={`w-5 h-5 shrink-0 ${
                    item.completed
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                />
                <div>
                  <p
                    className={`text-sm font-medium ${
                      item.completed
                        ? 'line-through text-slate-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {item.subject}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                    {DAYS[item.dayOfWeek]} · {item.startTime} ·{' '}
                    {item.durationMinutes} min · {item.focusType}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-2">
                {authProvider.supportsGoogleWorkspace && (
                  <button
                    type="button"
                    onClick={() => setCalendarConfirmItem(item)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                      item.calendarEventId
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {item.calendarEventId
                      ? 'Sincronizado na Agenda'
                      : 'Enviar ao Calendar'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteSchedule(item.id)}
                  className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                  aria-label="Remover sessão"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
