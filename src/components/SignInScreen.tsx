import React, { useState } from 'react';
import { BookOpen, FileText, BrainCircuit, Trophy, Moon, Sun } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';
import { PWAInstallButton } from './PWAInstallButton';

interface SignInScreenProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSuccess: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  theme,
  onToggleTheme,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      onSuccess();
    } catch (err: any) {
      setError(
        err?.message || 'Não foi possível concluir o login com o Google.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="max-w-7xl w-full mx-auto px-6 py-5 flex items-center justify-between gap-8 border-b border-slate-200 dark:border-slate-800">
        <span className="text-xl font-bold tracking-tight font-display whitespace-nowrap shrink-0">
          AprovaFoco
        </span>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a href="#recursos" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
            Banco de Questões
          </a>
          <a href="#recursos" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
            Importador PDF
          </a>
          <a href="#recursos" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
            Simulados
          </a>
          <a href="#recursos" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
            IA Adaptativa
          </a>
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Alternar modo escuro"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <PWAInstallButton />
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 lg:py-16">
        <div className="grid lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Tribunais, Fiscal, Policial, Bancos e TI</span>
              <span aria-hidden="true">·</span>
              <span>Cebraspe, FGV, FCC, Vunesp e Cesgranrio</span>
            </div>

            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight [text-wrap:balance]">
              Estude com banco comentado, leitura de PDFs por IA e revisão estratégica.
            </h1>

            <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 max-w-xl">
              Organize seu edital na nuvem, transforme provas em PDF em cadernos interativos, acompanhe seu desempenho por matéria e sincronize sua rotina no Google Calendar.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleLogin}
                disabled={isLoading}
                className="inline-flex items-center gap-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                {isLoading ? 'Conectando sua conta...' : 'Entrar com Google'}
              </button>

              <span className="text-xs text-slate-500 dark:text-slate-400">
                Acesso completo liberado para avaliação inicial
              </span>
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400 font-medium">
                {error}
              </p>
            )}
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800">
              {!imgFailed ? (
                <img
                  src="/src/assets/images/study_studio_tablet_1795627316589.jpg"
                  alt="Mesa de estudos moderna com tablet exibindo gráficos de desempenho e livros jurídicos"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-blue-600 to-slate-900 text-white">
                  <BookOpen className="w-12 h-12 opacity-80" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-6">
                <p className="text-sm font-semibold text-white">
                  Ambiente otimizado para leitura contínua em tablets e desktops
                </p>
                <p className="mt-1 text-xs text-slate-200">
                  Modo escuro noturno · Suporte offline em IndexedDB · Sincronização na nuvem
                </p>
              </div>
            </div>
          </div>
        </div>

        <section id="recursos" className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-8 border-t border-slate-200 dark:border-slate-800">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              Questões Comentadas
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Filtre por banca, carreira, disciplina e dificuldade com eliminação de alternativas.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              Importador PDF & Portais
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Extraia questões e comentários de provas em PDF ou colete cadernos de portais oficiais.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <BrainCircuit className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              IA Adaptativa por Edital
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Identifique lacunas reais por tópico e receba blocos de revisão sob medida.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <Trophy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
              Simulados & Gamificação
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Provas cronometradas com ranking atualizado, ofensiva diária e níveis de XP.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};
