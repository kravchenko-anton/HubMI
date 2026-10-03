import { create } from 'zustand';

import { USER_ZOOM } from '@/constants/map';
import { useMapViewportStore, type LngLat } from '@/stores/map-viewport-store';

export type MapSheetContent = 'search' | 'reports' | 'compose' | 'pick-location';

export type ReportCategory = {
  id: string;
  label: string;
  emoji: string;
};

export type ReportPhoto = {
  id: string;
  uri: string;
};

export type ReportLocation = {
  longitude: number;
  latitude: number;
  label: string;
  source: 'user' | 'picked';
};

export type ReportDraft = {
  category: ReportCategory | null;
  photos: ReportPhoto[];
  title: string;
  description: string;
  location: ReportLocation | null;
};

export const MAX_REPORT_PHOTOS = 5;

const emptyDraft = (): ReportDraft => ({
  category: null,
  photos: [],
  title: '',
  description: '',
  location: null,
});

type MapSheetState = {
  content: MapSheetContent;
  searchOpen: boolean;
  query: string;
  destination: string;
  reportCount: number;
  notice: string | null;
  draft: ReportDraft;
  showReports: () => void;
  showSearch: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  selectDestination: (name: string, notice?: string) => void;
  startReport: (category: ReportCategory) => void;
  cancelCompose: () => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  addPhotos: (uris: string[]) => void;
  removePhoto: (id: string) => void;
  setUserLocation: (location: ReportLocation) => void;
  beginPickLocation: () => void;
  cancelPickLocation: () => void;
  setPickedLocation: (location: ReportLocation) => void;
  submitReport: () => void;
  clearNotice: () => void;
};

function leaveReportFlow() {
  useMapViewportStore.getState().resumeTracking();
}

export const useMapSheetStore = create<MapSheetState>((set, get) => ({
  content: 'search',
  searchOpen: false,
  query: '',
  destination: 'Karkonoska',
  reportCount: 0,
  notice: null,
  draft: emptyDraft(),
  showReports: () => {
    leaveReportFlow();
    set({ content: 'reports', searchOpen: false, draft: emptyDraft() });
  },
  showSearch: () => {
    leaveReportFlow();
    set({ content: 'search', searchOpen: false, query: '', draft: emptyDraft() });
  },
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
  startReport: (category) =>
    set({
      content: 'compose',
      searchOpen: false,
      draft: { ...emptyDraft(), category },
    }),
  cancelCompose: () => {
    leaveReportFlow();
    set({ content: 'reports', draft: emptyDraft() });
  },
  setTitle: (title) => set((state) => ({ draft: { ...state.draft, title } })),
  setDescription: (description) => set((state) => ({ draft: { ...state.draft, description } })),
  addPhotos: (uris) =>
    set((state) => {
      const room = MAX_REPORT_PHOTOS - state.draft.photos.length;
      const photos = uris.slice(0, Math.max(room, 0)).map((uri, index) => ({
        id: `${Date.now()}-${index}-${uri.slice(-8)}`,
        uri,
      }));
      return { draft: { ...state.draft, photos: [...state.draft.photos, ...photos] } };
    }),
  removePhoto: (id) =>
    set((state) => ({
      draft: { ...state.draft, photos: state.draft.photos.filter((photo) => photo.id !== id) },
    })),
  setUserLocation: (location) =>
    set((state) => {
      if (state.draft.location) return state;
      return { draft: { ...state.draft, location } };
    }),
  beginPickLocation: () => {
    const { draft } = get();
    const viewport = useMapViewportStore.getState();
    const center: LngLat = draft.location
      ? [draft.location.longitude, draft.location.latitude]
      : viewport.center;
    viewport.pauseTracking();
    viewport.flyTo(center, USER_ZOOM);
    set({ content: 'pick-location' });
  },
  cancelPickLocation: () => {
    const { draft } = get();
    const viewport = useMapViewportStore.getState();
    if (draft.location?.source === 'picked') {
      viewport.pauseTracking();
      viewport.flyTo([draft.location.longitude, draft.location.latitude], USER_ZOOM);
    } else {
      viewport.resumeTracking();
    }
    set({ content: 'compose' });
  },
  setPickedLocation: (location) =>
    set((state) => ({
      content: 'compose',
      draft: { ...state.draft, location },
    })),
  submitReport: () => {
    const { draft } = get();
    if (!draft.category || !draft.location) return;
    const label = draft.title.trim() || draft.category.label;
    leaveReportFlow();
    set((state) => ({
      content: 'search',
      searchOpen: false,
      query: '',
      draft: emptyDraft(),
      reportCount: state.reportCount + 1,
      notice: `Zgłoszono: ${label}`,
    }));
  },
  clearNotice: () => set({ notice: null }),
}));
