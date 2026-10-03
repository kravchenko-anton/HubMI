import { create } from 'zustand';

import type { Issue } from '@/api/issues';
import { USER_ZOOM } from '@/constants/map';
import { useMapViewportStore, type LngLat } from '@/stores/map-viewport-store';

export type MapSheetContent = 'home' | 'reports' | 'compose' | 'pick-location' | 'issue';

export type ReportCategory = {
  id: string;
  label: string;
  emoji: string;
  tint: string;
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

const HOME_STACK: MapSheetContent[] = ['home'];

function route(stack: MapSheetContent[]) {
  const next = stack.slice();
  return {
    stack: next,
    content: next[next.length - 1] ?? 'home',
  };
}

/** Set before leaving the overlay so the sheet disappears instead of sliding down again. */
export const sheetMotion = { instantDismiss: false };

type MapSheetState = {
  stack: MapSheetContent[];
  content: MapSheetContent;
  reportCount: number;
  notice: string | null;
  draft: ReportDraft;
  selectedIssue: Issue | null;
  showReports: () => void;
  showHome: () => void;
  openIssue: (issue: Issue) => void;
  closeIssue: () => void;
  setSelectedIssue: (issue: Issue) => void;
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
  stack: HOME_STACK,
  content: 'home',
  reportCount: 0,
  notice: null,
  draft: emptyDraft(),
  selectedIssue: null,
  showReports: () => {
    leaveReportFlow();
    set({
      ...route(['home', 'reports']),
      draft: emptyDraft(),
      selectedIssue: null,
    });
  },
  showHome: () => {
    leaveReportFlow();
    set({ ...route(HOME_STACK), draft: emptyDraft(), selectedIssue: null });
  },
  openIssue: (issue) => {
    useMapViewportStore.getState().flyTo([issue.lng, issue.lat]);
    set({
      ...route(['home', 'issue']),
      selectedIssue: issue,
      draft: emptyDraft(),
    });
  },
  closeIssue: () => {
    set({ ...route(HOME_STACK), draft: emptyDraft(), selectedIssue: null });
  },
  setSelectedIssue: (issue) => set({ selectedIssue: issue }),
  startReport: (category) =>
    set({
      ...route(['home', 'reports', 'compose']),
      draft: { ...emptyDraft(), category },
      selectedIssue: null,
    }),
  cancelCompose: () => {
    leaveReportFlow();
    set({ ...route(['home', 'reports']), draft: emptyDraft() });
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
    set({ ...route(['home', 'reports', 'compose', 'pick-location']) });
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
    set({ ...route(['home', 'reports', 'compose']) });
  },
  setPickedLocation: (location) =>
    set((state) => ({
      ...route(['home', 'reports', 'compose']),
      draft: { ...state.draft, location },
    })),
  submitReport: () => {
    const { draft } = get();
    if (!draft.category || !draft.location) return;
    const label = draft.title.trim() || draft.category.label;
    leaveReportFlow();
    set((state) => ({
      ...route(HOME_STACK),
      draft: emptyDraft(),
      selectedIssue: null,
      reportCount: state.reportCount + 1,
      notice: `Reported: ${label}`,
    }));
  },
  clearNotice: () => set({ notice: null }),
}));
