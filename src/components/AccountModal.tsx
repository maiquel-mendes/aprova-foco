import React, { useEffect, useState } from 'react';
import {
  Check,
  Crown,
  LogOut,
  Moon,
  Plus,
  Sun,
  UserCheck,
  X,
} from 'lucide-react';
import { signOutUser } from '../lib/firebase';
import {
  activateStudyProfile,
  createStudyProfile,
  updateMyPreferences,
} from '../lib/firestoreDb';
import type { StudyGoalProfile, UserProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface AccountModalProps {
  open: boolean;
  user: UserProfile;
  profiles: StudyGoalProfile[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onUserUpdated: (user: UserProfile) => void;
  onProfilesChanged: () => void;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  open,
  user,
  profiles,
  theme,
  onToggleTheme,
  onUserUpdated,
  onProfilesChanged,
  onClose,
}) => {
  const [newProfileName, setNewProfileName] = useState('');
  const [newCareer, setNewCareer] = useState('Policial');
  const [newBoard, setNewBoard] = useState('Cebraspe');
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [dailyGoal, setDailyGoal] = useState(user.dailyGoal);
  const [busy, setBusy] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDisplayName(user.displayName || '');
      setDailyGoal(user.dailyGoal);
      setProfileFeedback(null);
      setProfileError(null);
    }
  }, [open, user.displayName, user.dailyGoal]);

  if (!open) return null;

  const roleLabel =
    user.role === 'admin'
      ? 'Administrador'
      : user.role === 'editor'
      ? 'Editor'
      : 'Estudante';

  const handleActivateProfile = async (id: string) => {
    setBusy(true);
    try {
      await activateStudyProfile(user.uid, id);
      onProfilesChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    setBusy(true);
    try {
      await createStudyProfile(user.uid, {
        name: newProfileName,
        career: newCareer,
        targetBoard: newBoard,
      });
      setNewProfileName('');
      onProfilesChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProfileFeedback(null);
    setProfileError(null);
    try {
      const updated = await updateMyPreferences(user.uid, {
        displayName: displayName.trim(),
        dailyGoal,
      });
      onUserUpdated(updated);
      setProfileFeedback('Informações do seu perfil atualizadas.');
    } catch (err: any) {
      setProfileError(err?.message || 'Erro ao atualizar perfil.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60"
      role="dialog"
      aria-modal="true"
    >
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Conta, Perfis & Preferências
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user.email} · {roleLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Fechar painel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Info + Theme + PWA + Daily Goal */}
        <section className="space-y-4">
          {profileFeedback && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
              {profileFeedback}
            </div>
          )}
          {profileError && (
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {profileError}
            </div>
          )}

          <form onSubmit={handleSaveProfileSettings} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Nome de Exibição
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                minLength={2}
                maxLength={60}
                required
                placeholder="Seu nome no ranking e fórum"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Meta Diária de Questões
              </span>
              <input
                type="number"
                min={5}
                max={200}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-sm font-mono-num"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-slate-900 dark:bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {busy ? 'Salvando...' : 'Salvar Dados do Perfil'}
            </button>
          </form>

          <div className="flex items-center justify-between gap-4 pt-2">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Aparência da Interface
            </span>
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" /> Modo Claro
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-blue-600" /> Modo Escuro
                </>
              )}
            </button>
          </div>

          <div className="pt-1">
            <PWAInstallButton />
          </div>
        </section>

        {/* Multi-Profile Switcher */}
        <section className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Perfis e Editais Simultâneos
          </h3>
          <div className="space-y-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => handleActivateProfile(p.id)}
                className={`w-full flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                  p.isActive
                    ? 'border-blue-600 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {p.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {p.career} · Banca {p.targetBoard}
                  </p>
                </div>
                {p.isActive && (
                  <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                )}
              </button>
            ))}
          </div>

          <form onSubmit={handleCreateProfile} className="space-y-2 pt-2">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Novo edital (ex.: Polícia Federal — Agente)"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newCareer}
                onChange={(e) => setNewCareer(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
              >
                <option value="Tribunais">Tribunais</option>
                <option value="Fiscal">Fiscal</option>
                <option value="Administrativo">Administrativo</option>
                <option value="Policial">Policial</option>
                <option value="Bancos">Bancos</option>
                <option value="TI">TI</option>
              </select>
              <select
                value={newBoard}
                onChange={(e) => setNewBoard(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
              >
                <option value="Cebraspe">Cebraspe</option>
                <option value="FGV">FGV</option>
                <option value="FCC">FCC</option>
                <option value="Vunesp">Vunesp</option>
                <option value="Cesgranrio">Cesgranrio</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={busy || !newProfileName.trim()}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Perfil de Estudo
            </button>
          </form>
        </section>

        {/* Plan Overview */}
        <section className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Plano Atual: Acesso Completo Liberado
            </h3>
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Todos os recursos avançados estão liberados para testes iniciais nesta versão. Estrutura preparada para assinatura mensal:
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Área Gratuita
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                Até 20 questões/dia, 1 perfil de edital e fórum comunitário.
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/30 p-3 space-y-1.5">
              <p className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Assinatura Mensal
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                PDFs ilimitados, IA adaptativa, simulados, offline e backup Drive.
              </p>
            </div>
          </div>
        </section>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={async () => {
              await signOutUser();
              onClose();
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-900 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
};
