import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  pendingCount: number;
  onSyncNow?: () => void;
  isSyncing?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  pendingCount,
  onSyncNow,
  isSyncing = false,
}) => {
  const isOnline = useOnlineStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 z-40 flex items-center gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/95 px-3.5 py-2 text-xs font-medium text-amber-900 dark:text-amber-100 shadow-lg">
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            Modo Offline ativo — respostas salvas localmente ({pendingCount} pendentes).
          </span>
        </>
      ) : (
        <>
          <RefreshCw
            className={`w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 ${
              isSyncing ? 'animate-spin' : ''
            }`}
          />
          <span>{pendingCount} resposta(s) offline aguardando sincronização.</span>
          {onSyncNow && (
            <button
              type="button"
              onClick={onSyncNow}
              disabled={isSyncing}
              className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 transition-colors cursor-pointer"
            >
              Sincronizar
            </button>
          )}
        </>
      )}
    </div>
  );
};
