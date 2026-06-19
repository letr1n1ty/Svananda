import React from 'react';
import type { UltraworkRunSummary, UltraworkCapabilities } from '../../types';
import { useStore } from '../../stores';
import { formatSessionDate } from '../../utils/format';
import css from './UltraworkPanel.module.css';

interface UltraworkRunListProps {
  runs: UltraworkRunSummary[];
  capabilities: UltraworkCapabilities | null;
  loading: boolean;
  error: string | null;
}

export function UltraworkRunList({ runs, capabilities, loading, error }: UltraworkRunListProps) {
  const setSelectedRunId = useStore((s) => s.setSelectedUltraworkRunId);

  return (
    <>
      <CapabilityCard capabilities={capabilities} loading={loading} error={error} />
      {runs.length === 0 ? (
        <div className={css.cardDescription} style={{ textAlign: 'center', padding: 'var(--space-lg) 0' }}>
          {loading ? 'Loading Ultrawork runs...' : 'No Ultrawork runs yet.'}
        </div>
      ) : (
        runs.map((run) => (
          <RunCard key={run.id} run={run} onClick={() => setSelectedRunId(run.id)} />
        ))
      )}
    </>
  );
}

function CapabilityCard({ capabilities, loading, error }: { capabilities: UltraworkCapabilities | null; loading: boolean; error: string | null }) {
  const actions = capabilities?.actions || [];
  const runners = capabilities?.packetRunners || [];
  return (
    <div className={css.capabilityCard}>
      <div className={css.cardHeader}>
        <div>
          <div className={css.cardTitle}>Runtime capabilities</div>
          <div className={css.cardMeta}>
            {loading ? 'Refreshing...' : error ? `Unavailable: ${error}` : 'Live API snapshot'}
          </div>
        </div>
      </div>
      <div className={css.pills}>
        <span className={css.pill}>actions {actions.length}</span>
        <span className={css.pill}>runners {runners.length}</span>
        <span className={css.pill}>artifact export {capabilities?.artifactExport ? 'on' : 'off'}</span>
        <span className={css.pill}>text gen {capabilities?.textGeneration ? 'on' : 'off'}</span>
      </div>
      {actions.length > 0 && <div className={css.cardDescription}>{actions.join(' · ')}</div>}
    </div>
  );
}

function RunCard({ run, onClick }: { run: UltraworkRunSummary; onClick: () => void }) {
  const packets = run.workPackets || [];
  const artifacts = run.artifacts || [];
  const exported = artifacts.filter(artifact => artifact.exportedFile?.fileId || artifact.exportedFile?.filePath).length;
  const terminalPackets = packets.filter(packet => ['completed', 'failed', 'cancelled'].includes(packet.status)).length;
  const updated = run.updatedAt ? formatSessionDate(run.updatedAt) : '';

  return (
    <div className={css.card} onClick={onClick}>
      <div className={css.cardHeader}>
        <div>
          <div className={css.cardTitle}>{run.goal || run.id}</div>
          <div className={css.cardMeta}>{updated || run.id}</div>
        </div>
        <span className={`${css.badge} ${
          run.status === 'waiting_confirmation' ? css.badgeWaiting :
          run.status === 'queued' ? css.badgeQueued :
          run.status === 'running' ? css.badgeRunning :
          run.status === 'completed' ? css.badgeCompleted :
          run.status === 'failed' ? css.badgeFailed : css.badgeCancelled
        }`}>{run.status}</span>
      </div>
      <div className={css.pills}>
        <span className={`${css.pill} ${css.pillHighlight}`}>{run.mode}</span>
        <span className={css.pill}>{run.intent}</span>
        <span className={css.pill}>packets {terminalPackets}/{packets.length}</span>
        <span className={css.pill}>artifacts {exported}/{artifacts.length} exported</span>
      </div>
      {packets.length > 0 && (
        <div className={css.cardDescription}>
          {packets.slice(0, 4).map(packet => `${packet.kind}:${packet.status}`).join(' · ')}
          {packets.length > 4 ? ` · +${packets.length - 4}` : ''}
        </div>
      )}
    </div>
  );
}
