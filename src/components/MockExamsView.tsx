import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Flag,
  Play,
  Trophy,
  XCircle,
} from 'lucide-react';
import { getRepositories } from '../repositories';
import type {
  MockExamRecord,
  QuestionItem,
  RankingEntry,
  UserProfile,
} from '../types';

interface MockExamsViewProps {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  rankingRefreshSignal: number;
}

interface GradedResult {
  questionId: string;
  subject: string;
  statement: string;
  selectedOption: string | null;
  correctOption: string;
  isCorrect: boolean;
  commentary: string;
}

export const MockExamsView: React.FC<MockExamsViewProps> = ({
  user,
  onUserUpdated,
  rankingRefreshSignal,
}) => {
  const repos = getRepositories();
  const [phase, setPhase] = useState<'setup' | 'running' | 'report'>('setup');
  const [title, setTitle] = useState('Simulado Nacional Multi-Bancas');
  const [board, setBoard] = useState('Todas');
  const [career, setCareer] = useState('Todas');
  const [questionLimit, setQuestionLimit] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [cebraspePenalty, setCebraspePenalty] = useState(false);

  const [examQuestions, setExamQuestions] = useState<QuestionItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [reportExam, setReportExam] = useState<MockExamRecord | null>(null);
  const [reportDetails, setReportDetails] = useState<GradedResult[]>([]);
  const [myExams, setMyExams] = useState<MockExamRecord[]>([]);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await repos.mockExams.listAndRankings(user.uid);
      setMyExams(data.myExams);
      setRankings(data.rankings);
    } catch {
      // ignore background refresh error
    }
  }, [repos, user.uid]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard, rankingRefreshSignal]);

  const handleFinishExam = useCallback(async () => {
    if (submitting || examQuestions.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const totalDurationSec = durationMinutes * 60;
      const elapsedSeconds = Math.max(10, totalDurationSec - secondsLeft);

      const res = await repos.mockExams.submit(user.uid, {
        title,
        board,
        career,
        durationMinutes,
        elapsedSeconds,
        cebraspePenalty,
        questions: examQuestions,
        answers,
      });

      if (res.user) onUserUpdated(res.user);
      setReportExam(res.exam);
      setReportDetails(res.detailedResults);
      setPhase('report');
      await loadLeaderboard();
    } catch (err: any) {
      setError(err?.message || 'Erro ao corrigir simulado.');
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    examQuestions,
    durationMinutes,
    secondsLeft,
    repos,
    user.uid,
    title,
    board,
    career,
    cebraspePenalty,
    answers,
    onUserUpdated,
    loadLeaderboard,
  ]);

  useEffect(() => {
    if (phase !== 'running') return;
    if (secondsLeft <= 0) {
      handleFinishExam();
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, secondsLeft, handleFinishExam]);

  const handleStartExam = async () => {
    setStarting(true);
    setError(null);
    try {
      const data = await repos.questions.query(user.uid, {
        board,
        career,
        limitCount: questionLimit,
      });
      if (data.questions.length === 0) {
        setError('Nenhuma questão disponível para esta combinação de filtros.');
        return;
      }
      setExamQuestions(data.questions.slice(0, questionLimit));
      setAnswers({});
      setFlagged({});
      setCurrentIdx(0);
      setSecondsLeft(durationMinutes * 60);
      setPhase('running');
    } catch (err: any) {
      setError(err?.message || 'Erro ao iniciar simulado.');
    } finally {
      setStarting(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (phase === 'running' && examQuestions[currentIdx]) {
    const q = examQuestions[currentIdx];
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
              Questão {currentIdx + 1} de {examQuestions.length} · {answeredCount} respondidas
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 font-mono-num text-sm font-bold ${
                secondsLeft < 120
                  ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              {formatTimer(secondsLeft)}
            </div>

            <button
              type="button"
              onClick={handleFinishExam}
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Corrigindo...' : 'Finalizar Prova'}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {q.board} · {q.subject} · {q.topic}
              </span>
              <button
                type="button"
                onClick={() =>
                  setFlagged((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                }
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  flagged[q.id]
                    ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                {flagged[q.id] ? 'Marcada para revisão' : 'Marcar revisão'}
              </button>
            </div>

            <p className="text-base leading-relaxed text-slate-900 dark:text-slate-100">
              {q.statement}
            </p>

            <div className="space-y-2.5">
              {q.optionsJson.map((opt) => {
                const chosen = answers[q.id] === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [q.id]: opt.key }))
                    }
                    className={`w-full flex items-start gap-3.5 rounded-lg border px-4 py-3 text-left min-h-[44px] transition-colors cursor-pointer ${
                      chosen
                        ? 'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 hover:border-blue-400'
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-mono-num font-bold ${
                        chosen
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {opt.key}
                    </span>
                    <span className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium disabled:opacity-40 cursor-pointer"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() =>
                  setAnswers((prev) => {
                    const next = { ...prev };
                    delete next[q.id];
                    return next;
                  })
                }
                className="text-xs text-slate-500 hover:underline cursor-pointer"
              >
                Deixar em branco
              </button>
              <button
                type="button"
                disabled={currentIdx >= examQuestions.length - 1}
                onClick={() =>
                  setCurrentIdx((i) =>
                    Math.min(examQuestions.length - 1, i + 1)
                  )
                }
                className="rounded-lg bg-slate-900 dark:bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 cursor-pointer"
              >
                Próxima
              </button>
            </div>
          </div>

          <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 h-fit">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Cartão-Resposta
            </h3>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {examQuestions.map((item, idx) => {
                const isAns = Boolean(answers[item.id]);
                const isRev = Boolean(flagged[item.id]);
                const isCurr = idx === currentIdx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-10 rounded-lg font-mono-num text-xs font-bold border transition-colors cursor-pointer ${
                      isCurr
                        ? 'ring-2 ring-blue-600 border-blue-600'
                        : 'border-slate-200 dark:border-slate-700'
                    } ${
                      isRev
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
                        : isAns
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (phase === 'report' && reportExam) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Relatório Pós-Prova: {reportExam.title}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {reportExam.board} · {reportExam.career} · +100 XP adicionados ao seu perfil
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPhase('setup')}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            Novo Simulado
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Nota Líquida</p>
            <p className="mt-2 text-3xl font-bold font-mono-num text-blue-600 dark:text-blue-400">
              {reportExam.netScore}%
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Acertos</p>
            <p className="mt-2 text-3xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
              {reportExam.correctCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Erros</p>
            <p className="mt-2 text-3xl font-bold font-mono-num text-red-600 dark:text-red-400">
              {reportExam.wrongCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Em Branco</p>
            <p className="mt-2 text-3xl font-bold font-mono-num text-slate-700 dark:text-slate-200">
              {reportExam.blankCount}
            </p>
          </div>
        </div>

        {reportExam.breakdownJson && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Desempenho por Disciplina no Simulado
            </h2>
            <div className="space-y-3">
              {reportExam.breakdownJson.map((item) => {
                const pct =
                  item.total > 0
                    ? Math.round((item.correct / item.total) * 100)
                    : 0;
                return (
                  <div key={item.subject}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {item.subject}
                      </span>
                      <span className="font-mono-num text-slate-600 dark:text-slate-300">
                        {item.correct}/{item.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 70
                            ? 'bg-emerald-500'
                            : pct >= 50
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Gabarito Comentado Questão a Questão
          </h2>
          {reportDetails.map((item, idx) => (
            <div
              key={item.questionId}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  Questão {idx + 1} · {item.subject}
                </span>
                {item.isCorrect ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Acertou ({item.correctOption})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                    <XCircle className="w-3.5 h-3.5" /> Sua resposta:{' '}
                    {item.selectedOption || 'Branco'} · Gabarito: {item.correctOption}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-900 dark:text-slate-100">
                {item.statement}
              </p>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 pt-1">
                {item.commentary}
              </p>
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Simulados Cronometrados & Ranking
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Treine gestão de tempo com correção imediata por disciplina e acompanhe sua posição no ranking geral.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Montar Novo Simulado
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Título do Simulado
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Banca
              </label>
              <select
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                <option value="Todas">Todas as Bancas</option>
                <option value="Cebraspe">Cebraspe</option>
                <option value="FGV">FGV</option>
                <option value="FCC">FCC</option>
                <option value="Vunesp">Vunesp</option>
                <option value="Cesgranrio">Cesgranrio</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Carreira
              </label>
              <select
                value={career}
                onChange={(e) => setCareer(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                <option value="Todas">Todas as Carreiras</option>
                <option value="Tribunais">Tribunais</option>
                <option value="Fiscal">Fiscal</option>
                <option value="Administrativo">Administrativo</option>
                <option value="Policial">Policial</option>
                <option value="Bancos">Bancos</option>
                <option value="TI">TI</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Quantidade de Questões
              </label>
              <select
                value={questionLimit}
                onChange={(e) => setQuestionLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm font-mono-num"
              >
                <option value={5}>5 questões (Rápido)</option>
                <option value={10}>10 questões (Padrão)</option>
                <option value={15}>15 questões (Intermediário)</option>
                <option value={20}>20 questões (Completo)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Tempo Limite
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm font-mono-num"
              >
                <option value={15}>15 minutos</option>
                <option value={20}>20 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>60 minutos</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={cebraspePenalty}
              onChange={(e) => setCebraspePenalty(e.target.checked)}
              className="rounded border-slate-300"
            />
            Aplicar regra Cebraspe (1 resposta errada anula 1 certa)
          </label>

          <button
            type="button"
            onClick={handleStartExam}
            disabled={starting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            {starting ? 'Preparando caderno...' : 'Iniciar Simulado Cronometrado'}
          </button>

          {myExams.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Seus Simulados Anteriores
              </h3>
              <div className="space-y-2">
                {myExams.slice(0, 5).map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 px-3.5 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {ex.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {ex.board} · {ex.correctCount}/{ex.totalQuestions} acertos
                      </p>
                    </div>
                    <span className="font-mono-num font-bold text-blue-600 dark:text-blue-400">
                      {ex.netScore}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 h-fit">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Ranking Nacional ao Vivo
              </h2>
            </div>
            <Award className="w-4 h-4 text-slate-400" />
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {rankings.length === 0 ? (
              <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
                Conclua um simulado para inaugurar o placar da temporada.
              </p>
            ) : (
              rankings.map((r, idx) => (
                <div
                  key={r.userId}
                  className="py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono-num text-xs font-bold ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : idx === 1
                          ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {r.displayName || 'Candidato'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                        Nível {r.level} · {r.examsCount} simulado(s)
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono-num font-bold text-slate-900 dark:text-white">
                      {r.xp} XP
                    </p>
                    <p className="text-xs font-mono-num text-emerald-600 dark:text-emerald-400">
                      Melhor: {r.bestScore}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
