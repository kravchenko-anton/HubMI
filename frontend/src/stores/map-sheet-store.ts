import { create } from 'zustand';

export type MapSheetContent = 'search' | 'reports';

type MapSheetState = {
  content: MapSheetContent;
  searchOpen: boolean;
  query: string;
  destination: string;
  reportCount: number;
  notice: string | null;
  showReports: () => void;
  showSearch: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  selectDestination: (name: string, notice?: string) => void;
  submitReport: (label: string) => void;
  clearNotice: () => void;
};

export const useMapSheetStore = create<MapSheetState>((set) => ({
  content: 'search',
  searchOpen: false,
  query: '',
  destination: 'Karkonoska',
  reportCount: 0,
  notice: null,
  showReports: () => set({ content: 'reports', searchOpen: false }),
  showSearch: () => set({ content: 'search', searchOpen: false, query: '' }),
  openSearch: () => set({ content: 'search', searchOpen: true }),
  closeSearch: () => set({ searchOpen: false, query: '' }),
  setQuery: (query) => set({ query }),
  selectDestination: (name, notice) =>
    set({
      destination: name,
      searchOpen: false,
      query: '',
      content: 'search',
      notice: notice ?? null,
    }),
  submitReport: (label) =>
    set((state) => ({
      content: 'search',
      searchOpen: false,
      query: '',
      reportCount: state.reportCount + 1,
      notice: `Zgłoszono: ${label}`,
    })),
  clearNotice: () => set({ notice: null }),
}));
