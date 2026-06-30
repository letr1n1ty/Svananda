import type { UltraworkRunSummary, UltraworkCapabilities } from '../types';

export interface UltraworkSlice {
  ultraworkRuns: UltraworkRunSummary[];
  selectedUltraworkRunId: string | null;
  ultraworkCapabilities: UltraworkCapabilities | null;
  ultraworkLoading: boolean;
  ultraworkError: string | null;
  setUltraworkRuns: (runs: UltraworkRunSummary[]) => void;
  setSelectedUltraworkRunId: (id: string | null) => void;
  setUltraworkCapabilities: (capabilities: UltraworkCapabilities | null) => void;
  setUltraworkLoading: (loading: boolean) => void;
  setUltraworkError: (error: string | null) => void;
}

export const createUltraworkSlice = (
  set: (partial: Partial<UltraworkSlice>) => void
): UltraworkSlice => ({
  ultraworkRuns: [],
  selectedUltraworkRunId: null,
  ultraworkCapabilities: null,
  ultraworkLoading: false,
  ultraworkError: null,
  setUltraworkRuns: (ultraworkRuns) => set({ ultraworkRuns }),
  setSelectedUltraworkRunId: (selectedUltraworkRunId) => set({ selectedUltraworkRunId }),
  setUltraworkCapabilities: (ultraworkCapabilities) => set({ ultraworkCapabilities }),
  setUltraworkLoading: (ultraworkLoading) => set({ ultraworkLoading }),
  setUltraworkError: (ultraworkError) => set({ ultraworkError }),
});
