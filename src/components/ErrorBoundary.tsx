import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Erro inesperado na aplicação.',
    };
  }

  override componentDidCatch(error: Error) {
    console.error('Uncaught UI error:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1120] p-6">
          <div className="max-w-md w-full rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Algo interrompeu esta tela
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ocorreu uma falha ao processar seus dados na nuvem. Recarregue a página para tentar novamente.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              Recarregar Plataforma
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
