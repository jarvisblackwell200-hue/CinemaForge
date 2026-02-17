import { create } from "zustand";
import type { StyleBible, Script } from "@/types/movie";

interface MovieState {
  currentMovieId: string | null;
  title: string;
  genre: string | null;
  synopsis: string | null;
  styleBible: StyleBible | null;
  script: Script | null;
  status: string;
  setCurrentMovie: (movieId: string) => void;
  setTitle: (title: string) => void;
  setGenre: (genre: string) => void;
  setSynopsis: (synopsis: string) => void;
  setStyleBible: (styleBible: StyleBible) => void;
  setScript: (script: Script) => void;
  setStatus: (status: string) => void;
  reset: () => void;
}

const initialState = {
  currentMovieId: null,
  title: "",
  genre: null,
  synopsis: null,
  styleBible: null,
  script: null,
  status: "CONCEPT",
};

export const useMovieStore = create<MovieState>((set) => ({
  ...initialState,
  setCurrentMovie: (movieId) => set({ currentMovieId: movieId }),
  setTitle: (title) => set({ title }),
  setGenre: (genre) => set({ genre }),
  setSynopsis: (synopsis) => set({ synopsis }),
  setStyleBible: (styleBible) => set({ styleBible }),
  setScript: (script) => set({ script }),
  setStatus: (status) => set({ status }),
  reset: () => set(initialState),
}));
