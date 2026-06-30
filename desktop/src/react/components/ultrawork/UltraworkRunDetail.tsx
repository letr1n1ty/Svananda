import React, { useState, useEffect } from 'react';
import type { UltraworkRunSummary } from '../../types';
import { useStore } from '../../stores';
import { loadUltraworkRun } from '../../stores/ultrawork-actions';
import { UltraworkPacketList } from './UltraworkPacketList';
import { UltraworkArtifactList } from './UltraworkArtifactList';
import { UltraworkActivityTimeline } from './UltraworkActivityTimeline';
import css from './UltraworkPanel.module.css';

interface UltraworkRunDetailProps {
  run: UltraworkRunSummary;
}

type TabType = 'packets' | 'artifacts' | 'activity';

export function UltraworkRunDetail({ run }: UltraworkRunDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('packets');
  const setSelectedRunId = useStore((s) => s.setSelectedUltraworkRunId);
  const [refreshing, setRefreshing] = useState(false);
  const t = (window as any).t ?? ((p: string) => p);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUltraworkRun(run.id);
    setRefreshing(false);
  };

  const isActive = ['queued', 'running', 'waiting_confirmation'].includes(run.status);
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      loadUltraworkRun(run.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [run.id, isActive]);

  const packets = run.workPackets || [];
  const artifacts = run.artifacts || [];

  return (
    <div className={css.detailContainer}>
      <div className={css.detailHeader}>
        <button className={css.backBtn} onClick={() => setSelectedRunId(null)} title="Back to list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h3 className={css.detailGoal}>{run.goal || run.id}</h3>
        <button className={css.refreshBtn} onClick={handleRefresh} disabled={refreshing} title="Refresh details">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      <div className={css.detailMetaList}>
        <div className={css.detailMetaRow}>
          <span className={css.detailMetaLabel}>Status</span>
          <span className={`${css.badge} ${
            run.status === 'waiting_confirmation' ? css.badgeWaiting :
            run.status === 'queued' ? css.badgeQueued :
            run.status === 'running' ? css.badgeRunning :
            run.status === 'completed' ? css.badgeCompleted :
            run.status === 'failed' ? css.badgeFailed : css.badgeCancelled
          }`}>{run.status}</span>
        </div>
        <div className={css.detailMetaRow}>
          <span className={css.detailMetaLabel}>Mode</span>
          <span className={css.detailMetaValue}>{run.mode}</span>
        </div>
        <div className={css.detailMetaRow}>
          <span className={css.detailMetaLabel}>Intent Route</span>
          <span className={css.detailMetaValue}>{run.intent}</span>
        </div>
        {run.sessionPath && (
          <div className={css.detailMetaRow}>
            <span className={css.detailMetaLabel}>Session Path</span>
            <span className={css.detailMetaValue} style={{ fontSize: '0.68rem', wordBreak: 'break-all' }}>{run.sessionPath}</span>
          </div>
        )}
      </div>

      <div className={css.tabs}>
        <button className={`${css.tab} ${activeTab === 'packets' ? css.tabActive : ''}`} onClick={() => setActiveTab('packets')}>
          Packets ({packets.length})
        </button>
        <button className={`${css.tab} ${activeTab === 'artifacts' ? css.tabActive : ''}`} onClick={() => setActiveTab('artifacts')}>
          Artifacts ({artifacts.length})
        </button>
        <button className={`${css.tab} ${activeTab === 'activity' ? css.tabActive : ''}`} onClick={() => setActiveTab('activity')}>
          Activity
        </button>
      </div>

      {activeTab === 'packets' && <UltraworkPacketList packets={packets} />}
      {activeTab === 'artifacts' && <UltraworkArtifactList artifacts={artifacts} />}
      {activeTab === 'activity' && <UltraworkActivityTimeline run={run} />}
    </div>
  );
}
