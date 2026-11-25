import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { getRepositories } from '../repositories';
import type { QuestionItem, QuestionOption } from '../types';

interface QuestionFormModalProps {
  open: boolean;
  currentUserUid: string;
  initialQuestion: QuestionItem | null;
  onSaved: (question: QuestionItem, isEdit: boolean) => void;
  onClose: () => void;
}

const BOARDS = ['FGV', 'Cebraspe', 'FCC', 'Vunesp', 'Cesgranrio'];
const CAREERS = [
  'Tribunais',
  'Fiscal',
  'Administrativo',
  'Policial',
  'Bancos',
  'TI',
];
const SUBJECTS = [
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

const DEFAULT_MC_OPTIONS: QuestionOption[] = [
  { key: 'A', text: '' },
  { key: 'B', text: '' },
  { key: 'C', text: '' },
  { key: 'D', text: '' },
  { key: 'E', text: '' },
];

const DEFAULT_TF_OPTIONS: QuestionOption[] = [
  { key: 'C', text: 'Certo' },
  { key: 'E', text: 'Errado' },
];

export const QuestionFormModal: React.FC<QuestionFormModalProps> = ({
  open,
  currentUserUid,
  initialQuestion,
  onSaved,
  onClose,
}) => {
  const isEdit = Boolean(initialQuestion);

  const [board, setBoard] = useState('FGV');
  const [career, setCareer] = useState('Tribunais');
  const [subject, setSubject] = useState('Direito Constitucional');
  const [topic, setTopic] = useState('');
  const [organ, setOrgan] = useState('');
  const [year, setYear] = useState(2025);
  const [difficulty, setDifficulty] = useState('Média');
  const [questionType, setQuestionType] = useState<'multiple_choice' | 'true_false'>(
    'multiple_choice'
  );
  const [statement, setStatement] = useState('');
  const [options, setOptions] = useState<QuestionOption[]>(DEFAULT_MC_OPTIONS);
  const [correctOption, setCorrectOption] = useState('A');
  const [commentary, setCommentary] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialQuestion) {
      setBoard(initialQuestion.board);
      setCareer(initialQuestion.career);
      setSubject(initialQuestion.subject);
      setTopic(initialQuestion.topic);
      setOrgan(initialQuestion.organ);
      setYear(initialQuestion.year);
      setDifficulty(initialQuestion.difficulty);
      const qType =
        initialQuestion.questionType === 'true_false'
          ? 'true_false'
          : 'multiple_choice';
      setQuestionType(qType);
      setStatement(initialQuestion.statement);
      setOptions(
        initialQuestion.optionsJson.length > 0
          ? initialQuestion.optionsJson.map((o) => ({ ...o }))
          : qType === 'true_false'
          ? DEFAULT_TF_OPTIONS
          : DEFAULT_MC_OPTIONS
      );
      setCorrectOption(initialQuestion.correctOption);
      setCommentary(initialQuestion.commentary);
    } else {
      setBoard('FGV');
      setCareer('Tribunais');
      setSubject('Direito Constitucional');
      setTopic('');
      setOrgan('');
      setYear(2025);
      setDifficulty('Média');
      setQuestionType('multiple_choice');
      setStatement('');
      setOptions(DEFAULT_MC_OPTIONS.map((o) => ({ ...o })));
      setCorrectOption('A');
      setCommentary('');
    }
  }, [open, initialQuestion]);

  if (!open) return null;

  const handleTypeChange = (nextType: 'multiple_choice' | 'true_false') => {
    setQuestionType(nextType);
    if (nextType === 'true_false') {
      setOptions(DEFAULT_TF_OPTIONS.map((o) => ({ ...o })));
      setCorrectOption('C');
    } else {
      setOptions(DEFAULT_MC_OPTIONS.map((o) => ({ ...o })));
      setCorrectOption('A');
    }
  };

  const handleAddOption = () => {
    const letters = 'ABCDE';
    const used = new Set(options.map((o) => o.key));
    const nextKey = letters.split('').find((l) => !used.has(l));
    if (!nextKey) return;
    setOptions((prev) => [...prev, { key: nextKey, text: '' }]);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    const removed = options[idx];
    const next = options.filter((_, i) => i !== idx);
    setOptions(next);
    if (removed && correctOption === removed.key && next[0]) {
      setCorrectOption(next[0].key);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanedOptions = options
      .map((o) => ({ key: o.key.trim().toUpperCase(), text: o.text.trim() }))
      .filter((o) => o.key && o.text);

    if (statement.trim().length < 10) {
      setError('O enunciado deve ter ao menos 10 caracteres.');
      return;
    }
    if (cleanedOptions.length < 2) {
      setError('Preencha pelo menos 2 alternativas válidas.');
      return;
    }
    if (!cleanedOptions.some((o) => o.key === correctOption.trim().toUpperCase())) {
      setError('Selecione um gabarito oficial correspondente a uma alternativa.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        board,
        career,
        subject,
        topic: topic.trim() || 'Tópico Geral',
        organ: organ.trim() || 'Órgão Público',
        year: Number(year) || 2025,
        difficulty,
        questionType,
        statement: statement.trim(),
        optionsJson: cleanedOptions,
        correctOption: correctOption.trim().toUpperCase(),
        commentary:
          commentary.trim() || 'Comentário cadastrado pela equipe editorial.',
      };

      const repos = getRepositories();
      const saved =
        isEdit && initialQuestion
          ? await repos.questions.update(initialQuestion.id, payload)
          : await repos.questions.create(payload, { uid: currentUserUid });

      onSaved(saved, isEdit);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar questão.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isEdit
                ? `Editar Questão ${initialQuestion?.code}`
                : 'Nova Questão no Banco'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Preencha os metadados da banca, enunciado, alternativas e comentário oficial.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Fechar formulário"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Banca
              </label>
              <select
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              >
                {BOARDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Carreira
              </label>
              <select
                value={career}
                onChange={(e) => setCareer(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              >
                {CAREERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Disciplina
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Assunto / Tópico
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex.: Controle de Constitucionalidade"
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Órgão
              </label>
              <input
                type="text"
                value={organ}
                onChange={(e) => setOrgan(e.target.value)}
                placeholder="Ex.: TRF-1"
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Ano
              </label>
              <input
                type="number"
                min={1990}
                max={2035}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Formato da Questão
              </label>
              <select
                value={questionType}
                onChange={(e) =>
                  handleTypeChange(
                    e.target.value as 'multiple_choice' | 'true_false'
                  )
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="multiple_choice">Múltipla Escolha (A–E)</option>
                <option value="true_false">Certo / Errado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Dificuldade
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="Fácil">Fácil</option>
                <option value="Média">Média</option>
                <option value="Difícil">Difícil</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Enunciado da Questão
            </label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              rows={4}
              required
              placeholder="Digite o enunciado completo da questão..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Alternativas & Gabarito Oficial
              </label>
              {questionType === 'multiple_choice' && options.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar alternativa
                </button>
              )}
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={opt.key} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrectOption(opt.key)}
                    title="Marcar como gabarito correto"
                    className={`h-9 w-10 shrink-0 rounded-lg border text-xs font-mono-num font-bold cursor-pointer transition-colors ${
                      correctOption === opt.key
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt.key}
                  </button>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((o, i) =>
                          i === idx ? { ...o, text: e.target.value } : o
                        )
                      )
                    }
                    placeholder={`Texto da alternativa ${opt.key}`}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                  {questionType === 'multiple_choice' && options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      aria-label={`Remover alternativa ${opt.key}`}
                      className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Clique na letra à esquerda para definir o gabarito oficial (atual:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {correctOption}
              </strong>
              ).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Comentário do Professor / Fundamentação
            </label>
            <textarea
              value={commentary}
              onChange={(e) => setCommentary(e.target.value)}
              rows={3}
              required
              placeholder="Explique por que o gabarito está correto e comente os principais distratores..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving
                ? 'Salvando...'
                : isEdit
                ? 'Salvar Alterações'
                : 'Cadastrar Questão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
