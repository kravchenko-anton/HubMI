import { create } from 'zustand';

import { KRAKOW_CENTER, USER_ZOOM } from '@/constants/map';

export type LngLat = [longitude: number, latitude: number];

type FlyRequest = {
  id: number;
  center: LngLat;
  zoom: number;
};

type MapViewportState = {
  center: LngLat;
  trackingPaused: boolean;
  flyRequest: FlyRequest | null;
  setCenter: (center: LngLat) => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  flyTo: (center: LngLat, zoom?: number) => void;
};

export const useMapViewportStore = create<MapViewportState>((set) => ({
  center: KRAKOW_CENTER,
  trackingPaused: false,
  flyRequest: null,
  setCenter: (center) => set({ center }),
  pauseTracking: () => set({ trackingPaused: true }),
  resumeTracking: () => set({ trackingPaused: false }),
  flyTo: (center, zoom = USER_ZOOM) =>
    set((state) => ({
      center,
      flyRequest: {
        id: (state.flyRequest?.id ?? 0) + 1,
        center,
        zoom,
      },
    })),
}));
