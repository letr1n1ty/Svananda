import { useStore } from './index';
import { hanaFetch } from '../hooks/use-hana-fetch';

export async function loadUltraworkPanel(): Promise<void> {
  const s = useStore.getState();
  useStore.setState({ ultraworkLoading: true, ultraworkError: null });

  try {
    const [capabilitiesRes, runsRes] = await Promise.all([
      hanaFetch('/api/ultrawork/capabilities'),
      hanaFetch('/api/ultrawork/runs?limit=12'),
    ]);

    const capabilitiesData = await capabilitiesRes.json();
    const runsData = await runsRes.json();

    if (capabilitiesData.error) throw new Error(capabilitiesData.error);
    if (runsData.error) throw new Error(runsData.error);

    useStore.setState({
      ultraworkCapabilities: capabilitiesData || null,
      ultraworkRuns: Array.isArray(runsData?.runs) ? runsData.runs : [],
    });
  } catch (err) {
    console.error('[ultrawork] load panel failed:', err);
    useStore.setState({
      ultraworkError: err instanceof Error ? err.message : String(err),
    });
  } finally {
    useStore.setState({ ultraworkLoading: false });
  }
}

export async function loadUltraworkRun(id: string): Promise<void> {
  try {
    const res = await hanaFetch(`/api/ultrawork/runs/${id}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const run = data.run;
    if (!run) return;

    const s = useStore.getState();
    const updatedRuns = s.ultraworkRuns.map(r => r.id === id ? { ...r, ...run } : r);
    if (!updatedRuns.some(r => r.id === id)) {
      updatedRuns.unshift(run);
    }

    useStore.setState({ ultraworkRuns: updatedRuns });
  } catch (err) {
    console.error(`[ultrawork] load run ${id} failed:`, err);
  }
}

export async function createUltraworkRun(input: any): Promise<any> {
  console.log('createUltraworkRun placeholder', input);
}

export async function confirmUltraworkRun(id: string, reason: string): Promise<void> {
  console.log('confirmUltraworkRun placeholder', id, reason);
}

export async function cancelUltraworkRun(id: string, reason: string): Promise<void> {
  console.log('cancelUltraworkRun placeholder', id, reason);
}

export async function runNextUltraworkPacket(id: string): Promise<void> {
  console.log('runNextUltraworkPacket placeholder', id);
}

export async function runUltraworkPacket(id: string, packetId: string): Promise<void> {
  console.log('runUltraworkPacket placeholder', id, packetId);
}

export async function syncUltraworkArtifacts(id: string): Promise<void> {
  console.log('syncUltraworkArtifacts placeholder', id);
}
