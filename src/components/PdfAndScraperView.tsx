import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileUp,
  Globe,
  Loader2,
  Plus,
  PlusCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  commitPdfQuestionsToFirestore,
  deletePdfImportAndQuestions,
  fetchAdminUsers,
  fetchPdfImports,
  fetchScrapeHistory,
  saveScrapedQuestionsToFirestore,
  updateUserRoleByAdmin,
} from '../lib/firestoreDb';
import type {
  AdminUserItem,
  PdfImportHistory,
  QuestionItem,
  ScrapeJobHistory,
  ScrapeSourcePreset,
  UserProfile,
  UserRole,
} from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { QuestionFormModal } from './QuestionFormModal';

interface ExtractedDraft {
  subject: string;
  topic: string;
  organ: string;
  difficulty: string;
  questionType: string;
  statement: string;
  options: { key: string; text: string }[];
  correctOption: string;
  commentary: string;
}

interface PdfAndScraperViewProps {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onQuestionsAdded: () => void;
}

export const PdfAndScraperView: React.FC<PdfAndScraperViewProps> = ({
  user,
  onUserUpdated,
  onQuestionsAdded,
}) => {
  const userRole = user.role;
  const currentUserId = user.uid;
  const isAdmin = userRole === 'admin';
  const [mode, setMode] = useState<'pdf' | 'scraper' | 'users'>('pdf');

  // PDF Import states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [board, setBoard] = useState('FGV');
  const [career, setCareer] = useState('Tribunais');
  const [year, setYear] = useState(2025);
  const [extracting, setExtracting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [drafts, setDrafts] = useState<ExtractedDraft[]>([]);
  const [pdfHistory, setPdfHistory] = useState<PdfImportHistory[]>([]);

  // Official Scraper states
  const [sources, setSources] = useState<ScrapeSourcePreset[]>([]);
  const [scrapeHistory, setScrapeHistory] = useState<ScrapeJobHistory[]>([]);
  const [customSourceName, setCustomSourceName] = useState('Portal Cebraspe Oficial');
  const [customSourceUrl, setCustomSourceUrl] = useState(
    'https://www.cebraspe.org.br/concursos'
  );
  const [customBoard, setCustomBoard] = useState('Cebraspe');
  const [customCareer, setCustomCareer] = useState('Tribunais');
  const [runningScrapeId, setRunningScrapeId] = useState<string | null>(null);
  const [scrapedPreview, setScrapedPreview] = useState<QuestionItem[]>([]);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // PDF deletion + Manual Question modal
  const [pdfDeleteTarget, setPdfDeleteTarget] =
    useState<PdfImportHistory | null>(null);
  const [deletingPdf, setDeletingPdf] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);

  // Admin User Management states
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin && mode !== 'pdf') {
      setMode('pdf');
    }
  }, [isAdmin, mode]);

  const loadMetadata = useCallback(async () => {
    try {
      const pdfs = await fetchPdfImports(user.uid, user.email);
      setPdfHistory(pdfs);

      if (isAdmin) {
        const [srcRes, jobs, usersList] = await Promise.all([
          apiFetch<{ sources: ScrapeSourcePreset[] }>('/api/scraper/sources'),
          fetchScrapeHistory(user.uid, user.email),
          fetchAdminUsers(user.uid, user.email),
        ]);
        setSources(srcRes.sources);
        setScrapeHistory(jobs);
        setAdminUsers(usersList);
      }
    } catch {
      // Ignore secondary metadata error on initial load
    }
  }, [isAdmin, user.uid, user.email]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  const handleExtractPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Selecione um arquivo PDF de prova ou material antes de continuar.');
      return;
    }

    setExtracting(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append(
        'title',
        title.trim() || selectedFile.name.replace(/\.pdf$/i, '')
      );
      formData.append('board', board);
      formData.append('career', career);
      formData.append('year', String(year));

      const data = await apiFetch<{
        title: string;
        extracted: ExtractedDraft[];
      }>('/api/pdfs/extract', {
        method: 'POST',
        body: formData,
      });

      setDrafts(data.extracted);
      setStatusMsg(
        `${data.extracted.length} questões extraídas e comentadas pela IA. Revise abaixo antes de gravar no banco de questões.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao analisar PDF.');
    } finally {
      setExtracting(false);
    }
  };

  const handleCommitDrafts = async () => {
    if (drafts.length === 0) return;
    setCommitting(true);
    setErrorMsg(null);
    try {
      const res = await commitPdfQuestionsToFirestore(user.uid, {
        title:
          title.trim() ||
          selectedFile?.name.replace(/\.pdf$/i, '') ||
          'Prova Importada',
        fileName: selectedFile?.name || 'prova.pdf',
        board,
        career,
        year,
        items: drafts,
      });
      if (res.user) onUserUpdated(res.user);
      setStatusMsg(
        `${res.insertedCount} questões salvas no banco na nuvem (+60 XP conquistados).`
      );
      setDrafts([]);
      setSelectedFile(null);
      setTitle('');
      onQuestionsAdded();
      await loadMetadata();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao salvar questões.');
    } finally {
      setCommitting(false);
    }
  };

  const handleRunScraper = async (payload: {
    id: string;
    sourceName: string;
    sourceUrl: string;
    board: string;
    career: string;
  }) => {
    setRunningScrapeId(payload.id);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const scraped = await apiFetch<{
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
          options: { key: string; text: string }[];
          correctOption: string;
          commentary: string;
        }[];
      }>('/api/scraper/run', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const saved = await saveScrapedQuestionsToFirestore(user.uid, {
        sourceName: scraped.sourceName,
        sourceUrl: scraped.sourceUrl,
        board: scraped.board,
        career: scraped.career,
        summary: scraped.summary,
        questions: scraped.questions,
      });

      setScrapedPreview(saved.questions);
      setStatusMsg(
        `Coleta finalizada: ${saved.insertedCount} questões incorporadas ao banco a partir de ${payload.sourceName}.`
      );
      onQuestionsAdded();
      await loadMetadata();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao executar coleta oficial.');
    } finally {
      setRunningScrapeId(null);
    }
  };

  const handleConfirmDeletePdf = async () => {
    if (!pdfDeleteTarget) return;
    setDeletingPdf(true);
    setErrorMsg(null);
    try {
      await deletePdfImportAndQuestions(pdfDeleteTarget.id);
      setPdfHistory((prev) =>
        prev.filter((item) => item.id !== pdfDeleteTarget.id)
      );
      setStatusMsg(
        `Caderno "${pdfDeleteTarget.title}" e suas questões vinculadas foram removidos.`
      );
      setPdfDeleteTarget(null);
      onQuestionsAdded();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao excluir caderno PDF.');
    } finally {
      setDeletingPdf(false);
    }
  };

  const handleChangeUserRole = async (userId: string, nextRole: UserRole) => {
    setUpdatingRoleId(userId);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const updated = await updateUserRoleByAdmin(
        userId,
        nextRole,
        adminUsers
      );
      setAdminUsers((prev) =>
        prev.map((u) => (u.id === userId ? updated : u))
      );
      setStatusMsg(
        `Permissão de ${updated.displayName || updated.email} atualizada para ${
          nextRole === 'admin'
            ? 'Administrador'
            : nextRole === 'editor'
            ? 'Editor'
            : 'Estudante'
        }.`
      );
      if (userId === currentUserId) {
        onUserUpdated({ ...user, role: updated.role });
        onQuestionsAdded();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao alterar permissão do usuário.');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isAdmin
              ? 'Painel Administrativo, Coletas & PDFs'
              : 'Estúdio Editorial de PDFs & Questões'}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {isAdmin
              ? 'Gerencie envios de PDFs, coletas em portais oficiais, banco de questões e níveis de permissão.'
              : 'Envie cadernos PDF com extração assistida por IA e gerencie questões comentadas no banco.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start">
          <button
            type="button"
            onClick={() => setManualModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Questão Manual
          </button>

          {isAdmin && (
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setMode('pdf')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'pdf'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Envio & Gestão de PDFs
              </button>
              <button
                type="button"
                onClick={() => setMode('scraper')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'scraper'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Coleta em Portais Oficiais
              </button>
              <button
                type="button"
                onClick={() => setMode('users')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'users'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Usuários e Permissões
              </button>
            </div>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {mode === 'pdf' ? (
        <div className="space-y-6">
          <form
            onSubmit={handleExtractPdf}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Nome da Prova ou Material
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Prova TRF-1 Analista Judiciário"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Banca Organizadora
                </label>
                <select
                  value={board}
                  onChange={(e) => setBoard(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="FGV">FGV</option>
                  <option value="Cebraspe">Cebraspe</option>
                  <option value="FCC">FCC</option>
                  <option value="Vunesp">Vunesp</option>
                  <option value="Cesgranrio">Cesgranrio</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Carreira & Ano
                </label>
                <div className="flex gap-2">
                  <select
                    value={career}
                    onChange={(e) => setCareer(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="Tribunais">Tribunais</option>
                    <option value="Fiscal">Fiscal</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="Policial">Policial</option>
                    <option value="Bancos">Bancos</option>
                    <option value="TI">TI</option>
                  </select>
                  <input
                    type="number"
                    min={2010}
                    max={2027}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2.5 text-sm font-mono-num text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 p-8 cursor-pointer hover:border-blue-500 transition-colors">
              <FileUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <span className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {selectedFile
                  ? `${selectedFile.name} (${Math.round(
                      selectedFile.size / 1024
                    )} KB)`
                  : 'Clique para selecionar um arquivo PDF (até 15 MB)'}
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Aceita provas anteriores, editais verticalizados ou apostilas em PDF
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={extracting || !selectedFile}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {extracting && <Loader2 className="w-4 h-4 animate-spin" />}
                {extracting
                  ? 'Extraindo e comentando com IA...'
                  : 'Extrair Questões do PDF'}
              </button>
            </div>
          </form>

          {drafts.length > 0 && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Revisão das Questões Extraídas ({drafts.length})
                </h2>
                <button
                  type="button"
                  onClick={handleCommitDrafts}
                  disabled={committing}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  {committing
                    ? 'Gravando na nuvem...'
                    : `Salvar ${drafts.length} Questões no Banco`}
                </button>
              </div>

              <div className="space-y-4">
                {drafts.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-semibold">#{idx + 1}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.topic}</span>
                        <span aria-hidden="true">·</span>
                        <span>Gabarito: {item.correctOption}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                        aria-label="Remover questão extraída"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <textarea
                      value={item.statement}
                      onChange={(e) =>
                        setDrafts((prev) =>
                          prev.map((d, i) =>
                            i === idx ? { ...d, statement: e.target.value } : d
                          )
                        )
                      }
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100"
                    />

                    <div className="grid sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                      {item.options.map((o) => (
                        <div
                          key={o.key}
                          className={`rounded-md border px-3 py-2 ${
                            o.key === item.correctOption
                              ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/30 font-medium'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <span className="font-mono-num font-bold mr-1.5">
                            {o.key})
                          </span>
                          {o.text}
                        </div>
                      ))}
                    </div>

                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      <strong className="text-slate-800 dark:text-slate-200">
                        Comentário:
                      </strong>{' '}
                      {item.commentary}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Histórico de Cadernos PDF Importados
            </h2>
            {pdfHistory.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Nenhum PDF importado ainda. Envie sua primeira prova acima para alimentar seu banco pessoal.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 pr-4">Material</th>
                      <th className="py-2.5 pr-4">Banca</th>
                      <th className="py-2.5 pr-4">Carreira</th>
                      <th className="py-2.5 pr-4 text-right">Questões</th>
                      <th className="py-2.5 pr-4 text-right">Data</th>
                      <th className="py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pdfHistory.map((h) => (
                      <tr key={h.id}>
                        <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                          {h.title}
                        </td>
                        <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                          {h.board}
                        </td>
                        <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                          {h.career}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono-num">
                          {h.extractedCount}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono-num text-slate-500 dark:text-slate-400">
                          {new Date(h.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setPdfDeleteTarget(h)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                            title="Excluir caderno PDF e suas questões"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : mode === 'scraper' && isAdmin ? (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.map((src) => (
              <div
                key={src.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{src.board}</span>
                    <span aria-hidden="true">·</span>
                    <span>{src.career}</span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                    {src.name}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                    {src.description}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={runningScrapeId !== null}
                  onClick={() =>
                    handleRunScraper({
                      id: src.id,
                      sourceName: src.name,
                      sourceUrl: src.url,
                      board: src.board,
                      career: src.career,
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {runningScrapeId === src.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Globe className="w-3.5 h-3.5" />
                  )}
                  {runningScrapeId === src.id
                    ? 'Coletando...'
                    : 'Executar Coleta Agora'}
                </button>
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Coleta Direta por URL Oficial Permitida
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <input
                type="text"
                value={customSourceName}
                onChange={(e) => setCustomSourceName(e.target.value)}
                placeholder="Nome da fonte"
                className="md:col-span-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
              />
              <input
                type="url"
                value={customSourceUrl}
                onChange={(e) => setCustomSourceUrl(e.target.value)}
                placeholder="https://www.cebraspe.org.br/concursos"
                className="md:col-span-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
              />
              <select
                value={customBoard}
                onChange={(e) => setCustomBoard(e.target.value)}
                className="md:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                <option value="Cebraspe">Cebraspe</option>
                <option value="FGV">FGV</option>
                <option value="FCC">FCC</option>
                <option value="Vunesp">Vunesp</option>
                <option value="Cesgranrio">Cesgranrio</option>
              </select>
              <button
                type="button"
                disabled={runningScrapeId !== null}
                onClick={() =>
                  handleRunScraper({
                    id: 'custom',
                    sourceName: customSourceName,
                    sourceUrl: customSourceUrl,
                    board: customBoard,
                    career: customCareer,
                  })
                }
                className="md:col-span-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Coletar URL
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Carreira destino:</span>
              <select
                value={customCareer}
                onChange={(e) => setCustomCareer(e.target.value)}
                className="rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs"
              >
                <option value="Tribunais">Tribunais</option>
                <option value="Fiscal">Fiscal</option>
                <option value="Administrativo">Administrativo</option>
                <option value="Policial">Policial</option>
                <option value="Bancos">Bancos</option>
                <option value="TI">TI</option>
              </select>
            </div>
          </section>

          {scrapedPreview.length > 0 && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Questões Recém-Coletadas ({scrapedPreview.length})
              </h2>
              {scrapedPreview.map((q) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-sm"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {q.code} · {q.board} · {q.subject} · Gabarito {q.correctOption}
                  </p>
                  <p className="mt-1.5 text-slate-900 dark:text-slate-100">
                    {q.statement}
                  </p>
                </div>
              ))}
            </section>
          )}

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Registro de Coletas Oficiais
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 pr-4">Portal Oficial</th>
                    <th className="py-2.5 pr-4">Banca / Carreira</th>
                    <th className="py-2.5 pr-4">Resumo</th>
                    <th className="py-2.5 text-right">Importadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {scrapeHistory.map((job) => (
                    <tr key={job.id}>
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                        {job.sourceName}
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                        {job.board} · {job.career}
                      </td>
                      <td className="py-3 pr-4 text-slate-500 dark:text-slate-400 max-w-md truncate">
                        {job.summary}
                      </td>
                      <td className="py-3 text-right font-mono-num font-semibold">
                        +{job.questionsImported}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : isAdmin ? (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Administrador
              </p>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Acesso integral ao sistema: coletas em portais oficiais, envio/exclusão de PDFs, CRUD de questões e controle de permissões.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Editor
              </p>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Pode cadastrar, editar e excluir questões do banco e enviar/gerenciar cadernos em PDF, sem acesso a coletas oficiais ou gestão de contas.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Estudante (Usuário)
              </p>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Acesso exclusivamente à aplicação de estudo (questões, simulados, painel IA e comunidade) e edição do próprio perfil.
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Contas Cadastradas e Níveis de Acesso ({adminUsers.length})
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 pr-4">Usuário</th>
                    <th className="py-2.5 pr-4">E-mail</th>
                    <th className="py-2.5 pr-4">Progresso</th>
                    <th className="py-2.5 text-right">Nível de Permissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {adminUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                        {u.displayName || u.email.split('@')[0]}
                        {u.id === currentUserId ? ' (Você)' : ''}
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                        {u.email}
                      </td>
                      <td className="py-3 pr-4 font-mono-num text-xs text-slate-500 dark:text-slate-400">
                        Nível {u.level} · {u.xp} XP
                      </td>
                      <td className="py-3 text-right">
                        <select
                          value={u.role}
                          disabled={updatingRoleId === u.id}
                          onChange={(e) =>
                            handleChangeUserRole(
                              u.id,
                              e.target.value as UserRole
                            )
                          }
                          aria-label={`Alterar permissão de ${u.email}`}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
                        >
                          <option value="admin">Administrador</option>
                          <option value="editor">Editor</option>
                          <option value="user">Estudante (Usuário)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      <QuestionFormModal
        open={manualModalOpen}
        currentUserUid={user.uid}
        initialQuestion={null}
        onSaved={(q) => {
          setStatusMsg(`Questão ${q.code} cadastrada manualmente no banco.`);
          onQuestionsAdded();
        }}
        onClose={() => setManualModalOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(pdfDeleteTarget)}
        title="Excluir Caderno PDF Importado"
        description={`Confirmar exclusão de "${pdfDeleteTarget?.title || ''}"? Todas as questões extraídas deste PDF também serão removidas do banco.`}
        confirmLabel="Excluir PDF"
        isBusy={deletingPdf}
        onConfirm={handleConfirmDeletePdf}
        onCancel={() => setPdfDeleteTarget(null)}
      />
    </div>
  );
};
