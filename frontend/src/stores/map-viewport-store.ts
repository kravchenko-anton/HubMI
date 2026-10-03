import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { CITY_ZOOM, KRAKOW_CENTER, USER_ZOOM } from '@/constants/map';

export type LngLat = [longitude: number, latitude: number];

export type MapBounds = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

export type MapView = {
  center: LngLat;
  zoom: number;
  bounds: MapBounds;
};

type FlyRequest = {
  id: number;
  center: LngLat;
  zoom: number;
};

type PersistedMapView = {
  center: LngLat;
  zoom: number;
};

type MapViewportState = {
  center: LngLat;
  zoom: number;
  bounds: MapBounds | null;
  trackingPaused: boolean;
  flyRequest: FlyRequest | null;
  setCenter: (center: LngLat) => void;
  setView: (view: MapView) => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  flyTo: (center: LngLat, zoom?: number) => void;
};

const hydrationListeners = new Set<() => void>();
let viewportHydrated = false;

function markViewportHydrated() {
  if (viewportHydrated) return;
  viewportHydrated = true;
  hydrationListeners.forEach((listener) => listener());
}

export function isViewportHydrated() {
  return viewportHydrated;
}

export function subscribeViewportHydrated(listener: () => void) {
  hydrationListeners.add(listener);
  return () => {
    hydrationListeners.delete(listener);
  };
}

const memoryStorage = new Map<string, string>();

const viewportStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return memoryStorage.get(name) ?? null;
    }
  },
  setItem: async (name, value) => {
    memoryStorage.set(name, value);
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // Native storage is unavailable until the dev client includes AsyncStorage.
    }
  },
  removeItem: async (name) => {
    memoryStorage.delete(name);
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // Native storage is unavailable until the dev client includes AsyncStorage.
    }
  },
};

function persistedMapView(value: unknown): PersistedMapView | null {
  if (!value || typeof value !== 'object') return null;
  const view = value as { center?: unknown; zoom?: unknown };
  if (!Array.isArray(view.center) || view.center.length !== 2) return null;
  const [longitude, latitude] = view.center;
  if (typeof longitude !== 'number' || typeof latitude !== 'number') return null;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (typeof view.zoom !== 'number' || !Number.isFinite(view.zoom)) return null;
  return { center: [longitude, latitude], zoom: view.zoom };
}

export const useMapViewportStore = create<MapViewportState>()(
  persist(
    (set) => ({
      center: KRAKOW_CENTER,
      zoom: CITY_ZOOM,
      bounds: null,
      trackingPaused: false,
      flyRequest: null,
      setCenter: (center) => set({ center }),
      setView: (view) =>
        set({
          center: view.center,
          zoom: view.zoom,
          bounds: view.bounds,
        }),
      pauseTracking: () => set({ trackingPaused: true }),
      resumeTracking: () => set({ trackingPaused: false }),
      flyTo: (center, zoom = USER_ZOOM) =>
        set((state) => ({
          center,
          trackingPaused: true,
          flyRequest: {
            id: (state.flyRequest?.id ?? 0) + 1,
            center,
            zoom,
          },
        })),
    }),
    {
      name: 'hubmi-map-viewport',
      storage: createJSONStorage(() => viewportStorage),
      partialize: (state) => ({
        center: state.center,
        zoom: state.zoom,
      }),
      merge: (persisted, current) => {
        const saved = persistedMapView(persisted);
        if (!saved) return current;
        return { ...current, center: saved.center, zoom: saved.zoom };
      },
      onRehydrateStorage: () => () => {
        markViewportHydrated();
      },
    },
  ),
);

if (!useMapViewportStore.persist) {
  markViewportHydrated();
}
