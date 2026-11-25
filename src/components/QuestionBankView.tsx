import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Brain,
  CheckCircle2,
  CloudDownload,
  MessageSquarePlus,
  Pencil,
  Plus,
  Scissors,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { apiFetch } from '../lib/api';
import {
  loadOfflineQuestions,
  queueOfflineAttempt,
  saveOfflineQuestions,
} from '../lib/offlineDb';
import { getRepositories } from '../repositories';
import type { QuestionItem, UserProfile } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { QuestionFormModal } from './QuestionFormModal';

interface QuestionBankViewProps {
  currentUser: UserProfile;
  activeProfileId: string | null;
  onUserUpdated: (user: UserProfile) => void;
  onPendingOfflineChange: () => void;
  onOpenForumForQuestion: (question: QuestionItem) => void;
  onQuestionsMutated?: () => void;
}

const BOARDS = ['Todas', 'Cebraspe', 'FGV', 'FCC', 'Vunesp', 'Cesgranrio'];
const CAREERS = [
  'Todas',
  'Tribunais',
  'Fiscal',
  'Administrativo',
  'Policial',
  'Bancos',
  'TI',
];
const SUBJECTS = [
  'Todas',
  'Direito Constitucional',
  'Direito Administrativo',
  'Língua Portuguesa',
  'Raciocínio Lógico',
  'Direito Tributário',
  'Direito Penal',
  'Processo Penal',
  'Conhecimentos Bancários',
  'Informática e TI',
  'Contabilidade Pública',
];
const DIFFICULTIES = ['Todas', 'Fácil', 'Média', 'Difícil'];

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({
  currentUser,
  activeProfileId,
  onUserUpdated,
  onPendingOfflineChange,
  onOpenForumForQuestion,
  onQuestionsMutated,
}) => {
  const repos = getRepositories();
  const isOnline = useOnlineStatus();
  const canManageQuestions =
    currentUser.role === 'admin' || currentUser.role === 'editor';

  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [board, setBoard] = useState('Todas');
  const [career, setCareer] = useState('Todas');
  const [subject, setSubject] = useState('Todas');
  const [difficulty, setDifficulty] = useState('Todas');
  const [sourceType, setSourceType] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    {}
  );
  const [eliminatedMap, setEliminatedMap] = useState<Record<string, boolean>>(
    {}
  );
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>(
    {}
  );
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [downloadingOffline, setDownloadingOffline] = useState(false);

  const [tutorOpenId, setTutorOpenId] = useState<string | null>(null);
  const [tutorPrompt, setTutorPrompt] = useState('');
  const [tutorReplies, setTutorReplies] = useState<Record<string, string>>({});
  const [tutorLoadingId, setTutorLoadingId] = useState<string | null>(null);

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<QuestionItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isOnline) {
        const cached = await loadOfflineQuestions();
        const filtered = cached.filter((q) => {
          if (board !== 'Todas' && q.board !== board) return false;
          if (career !== 'Todas' && q.career !== career) return false;
          if (subject !== 'Todas' && q.subject !== subject) return false;
          if (difficulty !== 'Todas' && q.difficulty !== difficulty) return false;
          if (sourceType !== 'Todos' && q.sourceType !== sourceType) return false;
          if (search.trim()) {
            const term = search.toLowerCase();
            return (
              q.statement.toLowerCase().includes(term) ||
              q.topic.toLowerCase().includes(term) ||
              q.organ.toLowerCase().includes(term)
            );
          }
          return true;
        });
        setQuestions(filtered);
        setTotal(filtered.length);
        return;
      }

      const data = await repos.questions.query(currentUser.uid, {
        board,
        career,
        subject,
        difficulty,
        sourceType,
        status: statusFilter,
        search,
        limitCount: 40,
      });
      setQuestions(data.questions);
      setTotal(data.total);
      await saveOfflineQuestions(data.questions).catch(() => {});
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar questões.');
    } finally {
      setLoading(false);
    }
  }, [
    repos,
    currentUser.uid,
    board,
    career,
    subject,
    difficulty,
    sourceType,
    statusFilter,
    search,
    isOnline,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuestions();
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchQuestions]);

  const handleDownloadOfflinePack = async () => {
    setDownloadingOffline(true);
    try {
      const offlineQuestions = await repos.questions.fetchOfflinePack();
      await saveOfflineQuestions(offlineQuestions);
      setFeedbackBanner(
        `${offlineQuestions.length} questões comentadas salvas no dispositivo para estudo offline.`
      );
    } catch (err: any) {
      setError(err?.message || 'Falha ao baixar pacote offline.');
    } finally {
      setDownloadingOffline(false);
    }
  };

  const toggleEliminate = (questionId: string, optionKey: string) => {
    const key = `${questionId}:${optionKey}`;
    setEliminatedMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmitAnswer = async (q: QuestionItem) => {
    const chosen = selectedOptions[q.id];
    if (!chosen) return;

    setSubmittingId(q.id);
    try {
      if (!isOnline) {
        const isCorrect =
          chosen.trim().toUpperCase() === q.correctOption.trim().toUpperCase();
        await queueOfflineAttempt({
          questionId: q.id,
          selectedOption: chosen,
          timeSpentSec: 45,
          createdAt: new Date().toISOString(),
        });
        onPendingOfflineChange();
        setQuestions((prev) =>
          prev.map((item) =>
            item.id === q.id
              ? {
                  ...item,
                  userAttempt: {
                    selectedOption: chosen,
                    isCorrect,
                    isBookmarked: Boolean(bookmarkedIds[q.id]),
                  },
                }
              : item
          )
        );
        return;
      }

      const res = await repos.questions.submitAttempt(currentUser.uid, {
        question: q,
        selectedOption: chosen,
        timeSpentSec: 45,
        profileId: activeProfileId,
        isBookmarked: Boolean(bookmarkedIds[q.id]),
      });

      if (res.user) {
        onUserUpdated(res.user);
      }

      setQuestions((prev) =>
        prev.map((item) =>
          item.id === q.id
            ? {
                ...item,
                commentary: res.commentary,
                userAttempt: {
                  selectedOption: chosen,
                  isCorrect: res.isCorrect,
                  isBookmarked: Boolean(bookmarkedIds[q.id]),
                },
              }
            : item
        )
      );

      setFeedbackBanner(
        res.isCorrect
          ? `Resposta correta! Você ganhou +${res.xpEarned} XP.`
          : `Gabarito ${res.correctOption}. Você ganhou +${res.xpEarned} XP pela prática.`
      );
    } catch (err: any) {
      setError(err?.message || 'Não foi possível registrar a resposta.');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleAskTutor = async (q: QuestionItem) => {
    setTutorLoadingId(q.id);
    try {
      const res = await apiFetch<{ reply: string }>('/api/ai/explain-question', {
        method: 'POST',
        body: JSON.stringify({
          statement: q.statement,
          board: q.board,
          subject: q.subject,
          correctOption: q.correctOption,
          commentary: q.commentary,
          userQuestion:
            tutorPrompt.trim() ||
            'Detalhe o fundamento jurídico ou gramatical do gabarito oficial.',
        }),
      });
      setTutorReplies((prev) => ({ ...prev, [q.id]: res.reply }));
      setTutorPrompt('');
    } catch (err: any) {
      setError(err?.message || 'Erro ao consultar tutor IA.');
    } finally {
      setTutorLoadingId(null);
    }
  };

  const handleQuestionSaved = (saved: QuestionItem, isEdit: boolean) => {
    if (isEdit) {
      setQuestions((prev) =>
        prev.map((item) =>
          item.id === saved.id
            ? { ...saved, userAttempt: item.userAttempt ?? null }
            : item
        )
      );
      setFeedbackBanner(`Questão ${saved.code} atualizada no banco.`);
    } else {
      setQuestions((prev) => [{ ...saved, userAttempt: null }, ...prev]);
      setTotal((t) => t + 1);
      setFeedbackBanner(`Questão ${saved.code} cadastrada com sucesso.`);
    }
    onQuestionsMutated?.();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await repos.questions.delete(deleteTarget.id);
      setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      setFeedbackBanner(`Questão ${deleteTarget.code} removida do banco.`);
      setDeleteTarget(null);
      onQuestionsMutated?.();
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir questão.');
    } finally {
      setDeleting(false);
    }
  };

  const statsLine = useMemo(() => {
    const answered = questions.filter((q) => q.userAttempt).length;
    const correct = questions.filter((q) => q.userAttempt?.isCorrect).length;
    return { answered, correct };
  }, [questions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Banco de Questões Comentadas
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 font-mono-num">
            {total} questões encontradas · {statsLine.answered} respondidas nesta lista ·{' '}
            {statsLine.correct} acertos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canManageQuestions && (
            <button
              type="button"
              disabled={!isOnline}
              onClick={() => {
                setEditingQuestion(null);
                setFormModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nova Questão
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadOfflinePack}
            disabled={!isOnline || downloadingOffline}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <CloudDownload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            {downloadingOffline ? 'Baixando caderno...' : 'Baixar para Offline'}
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm font-medium text-emerald-900 dark:text-emerald-200">
          <span>{feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
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

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por enunciado, órgão, assunto ou código..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <select
            value={board}
            onChange={(e) => setBoard(e.target.value)}
            aria-label="Filtrar por banca"
            className="md:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100"
          >
            {BOARDS.map((b) => (
              <option key={b} value={b}>
                Banca: {b}
              </option>
            ))}
          </select>

          <select
            value={career}
            onChange={(e) => setCareer(e.target.value)}
            aria-label="Filtrar por carreira"
            className="md:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100"
          >
            {CAREERS.map((c) => (
              <option key={c} value={c}>
                Carreira: {c}
              </option>
            ))}
          </select>

          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            aria-label="Filtrar por dificuldade"
            className="md:col-span-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                Dificuldade: {d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-label="Filtrar por disciplina"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  Disciplina: {s}
                </option>
              ))}
            </select>

            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              aria-label="Filtrar por origem"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
            >
              <option value="Todos">Origem: Todas</option>
              <option value="curated">Acervo Base</option>
              <option value="pdf_import">Importadas de PDF</option>
              <option value="portal_scrape">Portais Oficiais</option>
            </select>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-x-auto">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'unanswered', label: 'Não resolvidas' },
              { id: 'wrong', label: 'Erradas' },
              { id: 'correct', label: 'Acertadas' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-44 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
            />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            Nenhuma questão encontrada para os filtros selecionados
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {canManageQuestions
              ? 'Ajuste os filtros acima, cadastre uma questão manual ou importe novos cadernos em PDF.'
              : 'Ajuste os filtros acima para localizar outras questões comentadas no acervo.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setBoard('Todas');
              setCareer('Todas');
              setSubject('Todas');
              setDifficulty('Todas');
              setSourceType('Todos');
              setStatusFilter('all');
              setSearch('');
            }}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {questions.map((q) => {
            const answered = q.userAttempt;
            const currentSelection =
              selectedOptions[q.id] ?? answered?.selectedOption ?? '';
            const isBookmarked =
              bookmarkedIds[q.id] ?? answered?.isBookmarked ?? false;

            return (
              <article
                key={q.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">
                      {q.code}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-blue-700 dark:text-blue-400">
                      {q.board}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{q.organ}</span>
                    <span aria-hidden="true">·</span>
                    <span>{q.year}</span>
                    <span aria-hidden="true">·</span>
                    <span>{q.subject}</span>
                    <span aria-hidden="true">·</span>
                    <span>{q.topic}</span>
                    <span aria-hidden="true">·</span>
                    <span>{q.difficulty}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManageQuestions && isOnline && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestion(q);
                            setFormModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Editar questão"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(q)}
                          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:border-red-300 dark:hover:border-red-800 transition-colors cursor-pointer"
                          aria-label={`Excluir questão ${q.code}`}
                          title="Excluir questão"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setBookmarkedIds((prev) => ({
                          ...prev,
                          [q.id]: !isBookmarked,
                        }))
                      }
                      className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                        isBookmarked
                          ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                      aria-label="Salvar questão para revisão"
                      title="Favoritar para revisão"
                    >
                      <Bookmark className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenForumForQuestion(q)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      Fórum
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-[15px] sm:text-base leading-[1.68] text-slate-900 dark:text-slate-100 max-w-4xl">
                  {q.statement}
                </p>

                <div className="mt-5 space-y-2.5">
                  {q.optionsJson.map((opt) => {
                    const isSelected = currentSelection === opt.key;
                    const isEliminated = Boolean(
                      eliminatedMap[`${q.id}:${opt.key}`]
                    );
                    const isCorrectOpt =
                      answered &&
                      opt.key.toUpperCase() === q.correctOption.toUpperCase();
                    const isWrongSelected =
                      answered &&
                      isSelected &&
                      opt.key.toUpperCase() !== q.correctOption.toUpperCase();

                    let optionStyle =
                      'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-blue-400 dark:hover:border-blue-600';
                    if (isCorrectOpt) {
                      optionStyle =
                        'border-emerald-500 bg-emerald-50/80 dark:border-emerald-600 dark:bg-emerald-950/40';
                    } else if (isWrongSelected) {
                      optionStyle =
                        'border-red-500 bg-red-50/80 dark:border-red-600 dark:bg-red-950/40';
                    } else if (isSelected) {
                      optionStyle =
                        'border-blue-600 bg-blue-50/80 dark:border-blue-500 dark:bg-blue-950/40';
                    }

                    return (
                      <div
                        key={opt.key}
                        className={`flex items-stretch gap-2 rounded-lg border transition-colors ${optionStyle}`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedOptions((prev) => ({
                              ...prev,
                              [q.id]: opt.key,
                            }))
                          }
                          className={`flex-1 flex items-start gap-3.5 px-4 py-3 text-left min-h-[44px] cursor-pointer ${
                            isEliminated ? 'line-through opacity-45' : ''
                          }`}
                        >
                          <span
                            className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-mono-num font-bold ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {opt.key}
                          </span>
                          <span className="text-sm sm:text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
                            {opt.text}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleEliminate(q.id, opt.key)}
                          title="Riscar alternativa"
                          aria-label={`Riscar alternativa ${opt.key}`}
                          className="px-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-l border-slate-200/70 dark:border-slate-800 cursor-pointer"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSubmitAnswer(q)}
                      disabled={!currentSelection || submittingId === q.id}
                      className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {submittingId === q.id
                        ? 'Corrigindo...'
                        : answered
                        ? 'Responder Novamente'
                        : 'Confirmar Resposta'}
                    </button>

                    {answered && (
                      <div className="inline-flex items-center gap-1.5 text-sm font-semibold">
                        {answered.isCorrect ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            Acerto · Gabarito {q.correctOption}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400">
                            <XCircle className="w-4 h-4" />
                            Errou · Gabarito {q.correctOption}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setTutorOpenId(tutorOpenId === q.id ? null : q.id)
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <Brain className="w-4 h-4" />
                    Tirar dúvida com Tutor IA
                  </button>
                </div>

                {answered && (
                  <div className="mt-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Comentário do Professor
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      {q.commentary}
                    </p>
                  </div>
                )}

                {tutorOpenId === q.id && (
                  <div className="mt-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 p-4 space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tutorPrompt}
                        onChange={(e) => setTutorPrompt(e.target.value)}
                        placeholder="Ex: Por que a alternativa C está incorreta segundo o STF?"
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleAskTutor(q)}
                        disabled={tutorLoadingId === q.id || !isOnline}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {tutorLoadingId === q.id ? 'Analisando...' : 'Perguntar'}
                      </button>
                    </div>
                    {tutorReplies[q.id] && (
                      <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                        {tutorReplies[q.id]}
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <QuestionFormModal
        open={formModalOpen}
        currentUserUid={currentUser.uid}
        initialQuestion={editingQuestion}
        onSaved={handleQuestionSaved}
        onClose={() => {
          setFormModalOpen(false);
          setEditingQuestion(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir Questão do Banco"
        description={`Tem certeza que deseja excluir permanentemente a questão ${deleteTarget?.code || ''}?`}
        confirmLabel="Excluir Questão"
        isBusy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
