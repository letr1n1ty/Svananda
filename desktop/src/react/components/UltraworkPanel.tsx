import React from 'react';
import { useStore } from '../stores';
import { loadUltraworkPanel } from '../stores/ultrawork-actions';
import { usePanel } from '../hooks/use-panel';
import { UltraworkRunList } from './ultrawork/UltraworkRunList';
import { UltraworkRunDetail } from './ultrawork/UltraworkRunDetail';
import fp from './FloatingPanels.module.css';
import css from './ultrawork/UltraworkPanel.module.css';

export function UltraworkPanel() {
  const runs = useStore((s) => s.ultraworkRuns);
  const selectedRunId = useStore((s) => s.selectedUltraworkRunId);
  const capabilities = useStore((s) => s.ultraworkCapabilities);
  const loading = useStore((s) => s.ultraworkLoading);
  const error = useStore((s) => s.ultraworkError);

  const t = (window as any).t ?? ((p: string) => p);

  const { visible, close: closePanel } = usePanel('ultrawork', loadUltraworkPanel, []);

  const selectedRun = runs.find((r) => r.id === selectedRunId);

  if (!visible) return null;

  return (
    <div className={fp.floatingPanel} id="ultraworkPanel">
      <div className={fp.floatingPanelInner}>
        <div className={css.panel}>
          <div className={css.panelHeader}>
            <h2 className={css.panelTitle}>Omni Ultrawork</h2>
            <div className={css.headerActions}>
              {!selectedRun && (
                <button className={css.refreshBtn} onClick={loadUltraworkPanel} disabled={loading} title="Refresh panel">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                    <path d="M23 4v6h-6M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </button>
              )}
              <button className={css.closeBtn} onClick={closePanel} aria-label={t('common.close')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          <div className={fp.floatingPanelBody}>
            {selectedRun ? (
              <UltraworkRunDetail run={selectedRun} />
            ) : (
              <UltraworkRunList runs={runs} capabilities={capabilities} loading={loading} error={error} />
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

