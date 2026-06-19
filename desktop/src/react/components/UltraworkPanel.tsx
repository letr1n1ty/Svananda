import { useCallback, useState } from 'react';
import { usePanel } from '../hooks/use-panel';
import { hanaFetch } from '../hooks/use-hana-fetch';
import { formatSessionDate } from '../utils/format';
import fp from './FloatingPanels.module.css';
import automationStyles from './automation/AutomationPanel.module.css';

interface UltraworkRunSummary {
  id: string;
  goal: string;
  mode: string;
  intent: string;
  status: string;
  sessionPath?: string | null;
  workPackets?: Array<{ id: string; title: string; kind: string; status: string; agent: string }>;
  artifacts?: Array<{ id: string; kind: string; title: string; exportedFile?: { fileId?: string | null; filePath?: string | null } | null }>;
  updatedAt?: string;
  createdAt?: string;
}

interface UltraworkCapabilities {
  modes?: string[];
  actions?: string[];
  workPacketKinds?: string[];
  packetRunners?: Array<{ kind: string; name: string | null }>;
  artifactExport?: boolean;
  textGeneration?: boolean;
}

const PANEL_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 };
const STACK_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' };
const META_STYLE: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 6 };
const PILL_STYLE: React.CSSProperties = {
  fontSize: '0.68rem',
  color: 'var(--text-muted)',
  border: '1px solid var(--overlay-light)',
  borderRadius: 999,
  padding: '2px 7px',
};

export function UltraworkPanel() {
  const [runs, setRuns] = useState<UltraworkRunSummary[]>([]);
  const [capabilities, setCapabilities] = useState<UltraworkCapabilities | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = window.t ?? ((p: string) => p);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      hanaFetch('/api/ultrawork/capabilities').then(res => res.json()),
      hanaFetch('/api/ultrawork/runs?limit=12').then(res => res.json()),
    ])
      .then(([capabilityData, runData]) => {
        setCapabilities(capabilityData || null);
        setRuns(Array.isArray(runData?.runs) ? runData.runs : []);
      })
      .catch((err: unknown) => {
        console.warn('[ultrawork] fetch panel data failed:', err);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const { visible, close } = usePanel('ultrawork', loadData, []);
  if (!visible) return null;

  return (
    <div className={fp.floatingPanel} id="ultraworkPanel">
      <div className={fp.floatingPanelInner}>
        <div style={PANEL_STYLE}>
          <div className={fp.floatingPanelHeader}>
            <h2 className={fp.floatingPanelTitle}>Omni Ultrawork</h2>
            <button className={fp.floatingPanelClose} onClick={close} aria-label={t('common.close')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className={fp.floatingPanelBody}>
            <div style={STACK_STYLE}>
              <CapabilityCard capabilities={capabilities} loading={loading} error={error} />
              {runs.length === 0 ? (
                <div className={fp.activityEmpty}>{loading ? 'Loading Ultrawork runs…' : 'No Ultrawork runs yet.'}</div>
              ) : runs.map(run => <RunCard key={run.id} run={run} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CapabilityCard({ capabilities, loading, error }: { capabilities: UltraworkCapabilities | null; loading: boolean; error: string | null }) {
  const actions = capabilities?.actions || [];
  const runners = capabilities?.packetRunners || [];
  return (
    <div className={automationStyles.groupCard}>
      <div className={automationStyles.groupHeader}>
        <div>
          <div className={automationStyles.groupTitle}>Runtime capabilities</div>
          <div className={automationStyles.groupMeta}>
            {loading ? 'Refreshing…' : error ? `Unavailable: ${error}` : 'Live API snapshot'}
          </div>
        </div>
      </div>
      <div style={META_STYLE}>
        <span style={PILL_STYLE}>actions {actions.length}</span>
        <span style={PILL_STYLE}>runners {runners.length}</span>
        <span style={PILL_STYLE}>artifact export {capabilities?.artifactExport ? 'on' : 'off'}</span>
        <span style={PILL_STYLE}>text gen {capabilities?.textGeneration ? 'on' : 'off'}</span>
      </div>
      {actions.length > 0 && <div className={automationStyles.groupDescription}>{actions.join(' · ')}</div>}
    </div>
  );
}

function RunCard({ run }: { run: UltraworkRunSummary }) {
  const packets = run.workPackets || [];
  const artifacts = run.artifacts || [];
  const exported = artifacts.filter(artifact => artifact.exportedFile?.fileId || artifact.exportedFile?.filePath).length;
  const terminalPackets = packets.filter(packet => ['completed', 'failed', 'cancelled'].includes(packet.status)).length;
  const updated = run.updatedAt ? formatSessionDate(run.updatedAt) : '';

  return (
    <div className={automationStyles.groupCard}>
      <div className={automationStyles.groupHeader}>
        <div>
          <div className={automationStyles.groupTitle}>{run.goal || run.id}</div>
          <div className={automationStyles.groupMeta}>{updated || run.id}</div>
        </div>
        <span className={automationStyles.groupBadge}>{run.status}</span>
      </div>
      <div style={META_STYLE}>
        <span style={PILL_STYLE}>{run.mode}</span>
        <span style={PILL_STYLE}>{run.intent}</span>
        <span style={PILL_STYLE}>packets {terminalPackets}/{packets.length}</span>
        <span style={PILL_STYLE}>artifacts {exported}/{artifacts.length} exported</span>
      </div>
      {packets.length > 0 && (
        <div className={automationStyles.groupDescription}>
          {packets.slice(0, 4).map(packet => `${packet.kind}:${packet.status}`).join(' · ')}
          {packets.length > 4 ? ` · +${packets.length - 4}` : ''}
        </div>
      )}
    </div>
  );
}
