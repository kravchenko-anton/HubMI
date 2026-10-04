import { create } from 'zustand';

export type ConfettiOrigin = 'top' | 'bottom';

type ConfettiState = {
  id: number;
  origin: ConfettiOrigin | null;
  play: (origin: ConfettiOrigin) => void;
  stop: (id: number) => void;
};

export const useConfettiStore = create<ConfettiState>((set) => ({
  id: 0,
  origin: null,
  play: (origin) => set((state) => ({ id: state.id + 1, origin })),
  stop: (id) => set((state) => (state.id === id ? { origin: null } : state)),
}));
