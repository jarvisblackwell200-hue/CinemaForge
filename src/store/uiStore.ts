import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  cameraMovementBrowserOpen: boolean;
  activeModal: string | null;
  setSidebarOpen: (open: boolean) => void;
  setCameraMovementBrowserOpen: (open: boolean) => void;
  setActiveModal: (modal: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  cameraMovementBrowserOpen: false,
  activeModal: null,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCameraMovementBrowserOpen: (open) =>
    set({ cameraMovementBrowserOpen: open }),
  setActiveModal: (modal) => set({ activeModal: modal }),
}));
