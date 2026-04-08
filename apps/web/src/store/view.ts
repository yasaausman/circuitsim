import { create } from "zustand";

interface ViewStore {
  fitViewToken: number;
  requestFitView: () => void;
}

export const useViewStore = create<ViewStore>()((set) => ({
  fitViewToken: 0,
  requestFitView: () => set((state) => ({ fitViewToken: state.fitViewToken + 1 })),
}));
