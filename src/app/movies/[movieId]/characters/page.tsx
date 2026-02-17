"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Users,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CharacterWizard } from "@/components/movie/CharacterWizard";
import { CharacterCard } from "@/components/movie/CharacterCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Character {
  id: string;
  movieId: string;
  name: string;
  role: string | null;
  visualDescription: string;
  referenceImages: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function CharactersPage() {
  const params = useParams<{ movieId: string }>();
  const movieId = params.movieId;

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wizard dialog state
  const [wizardOpen, setWizardOpen] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
  const [deleting, setDeleting] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch characters
  // -------------------------------------------------------------------------

  const fetchCharacters = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/characters?movieId=${movieId}`, {
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error ?? "Failed to load characters");
        return;
      }

      setCharacters(result.data as Character[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [movieId]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  // -------------------------------------------------------------------------
  // Delete character
  // -------------------------------------------------------------------------

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/characters?id=${deleteTarget.id}&movieId=${movieId}`,
        {
          method: "DELETE",
          }
      );

      if (response.ok) {
        setCharacters((prev) =>
          prev.filter((c) => c.id !== deleteTarget.id)
        );
      }
    } catch {
      // Silently handle -- user can retry
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // -------------------------------------------------------------------------
  // Wizard complete handler
  // -------------------------------------------------------------------------

  const handleWizardComplete = (character: Character) => {
    setCharacters((prev) => [...prev, character]);
    setWizardOpen(false);
  };

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error && characters.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">Failed to load characters</h2>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={fetchCharacters}>
          Retry
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Characters</h1>
          <p className="text-sm text-muted-foreground">
            {characters.length === 0
              ? "Define the cast for your film"
              : `${characters.length} character${characters.length !== 1 ? "s" : ""} defined`}
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Character
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {characters.length === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">No characters yet</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Define your characters with detailed visual descriptions and
              reference images. Consistency starts here -- the more detail you
              provide, the better your characters will look across every shot.
            </p>
            <Button onClick={() => setWizardOpen(true)} className="mt-2">
              <Plus className="mr-2 h-4 w-4" />
              Add your first character
            </Button>
          </div>
        ) : (
          /* Character grid */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onEdit={() => {
                  // For now, edit reopens the wizard -- full edit flow can be
                  // added later when the wizard supports editing mode.
                }}
                onDelete={() => setDeleteTarget(character)}
              />
            ))}

            {/* Add card */}
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm font-medium">Add Character</span>
            </button>
          </div>
        )}
      </div>

      {/* Character Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Create Character
            </DialogTitle>
            <DialogDescription>
              Build a detailed character profile for consistent AI generation.
            </DialogDescription>
          </DialogHeader>
          <CharacterWizard
            movieId={movieId}
            onComplete={handleWizardComplete}
            onCancel={() => setWizardOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Character
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action cannot be undone. Any shots referencing this
              character will need to be updated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
