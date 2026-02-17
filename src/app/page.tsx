import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Film,
  Clapperboard,
  Sparkles,
  Video,
  Layers,
  ArrowRight,
} from "lucide-react";

const STEPS = [
  {
    icon: Sparkles,
    title: "Describe your idea",
    description:
      "Tell the AI Director your movie concept in plain English. It breaks your idea into scenes, characters, and shots.",
  },
  {
    icon: Clapperboard,
    title: "Plan every shot",
    description:
      "Browse 30+ camera movements. The AI suggests angles based on your story's emotional beats and genre conventions.",
  },
  {
    icon: Video,
    title: "Generate & compare",
    description:
      "Generate multiple takes per shot. Compare side-by-side and pick the best. Smart retries protect your credits.",
  },
  {
    icon: Layers,
    title: "Assemble & export",
    description:
      "Arrange shots on the timeline, set transitions, and export your finished short film as MP4.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-2">
          <Film className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">
            CinemaForge
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col">
        <section className="flex flex-col items-center justify-center gap-6 px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Powered by Kling 3.0 + Claude AI
          </div>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            From idea to short film.
            <br />
            <span className="text-primary">AI does the directing.</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Describe your movie in plain English. CinemaForge structures your
            script, suggests cinematography, generates video shot-by-shot, and
            assembles the final cut.
          </p>
          <div className="flex gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/signup">
                Start creating
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            50 free credits on signup. No credit card required.
          </p>
        </section>

        {/* How it works */}
        <section className="border-t border-border/50 bg-card/50 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-12 text-center text-2xl font-semibold tracking-tight">
              How it works
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <div key={step.title} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      Step {i + 1}
                    </span>
                  </div>
                  <h3 className="text-base font-medium">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Genre showcase */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="mb-4 text-2xl font-semibold tracking-tight">
              Built-in genre intelligence
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-muted-foreground">
              Select a genre and CinemaForge automatically configures camera
              preferences, lighting styles, color grading, and pacing.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                "Film Noir",
                "Sci-Fi",
                "Horror",
                "Commercial",
                "Documentary",
              ].map((genre) => (
                <div
                  key={genre}
                  className="rounded-lg border border-border bg-secondary/50 px-5 py-3 text-sm font-medium transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  {genre}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/50 bg-card/50 px-6 py-20">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Ready to direct your first AI film?
            </h2>
            <p className="text-muted-foreground">
              Start with 50 free credits — enough to script, plan, and preview
              your first short film before committing to generation.
            </p>
            <Button asChild size="lg">
              <Link href="/signup">
                Create your movie
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-primary/60" />
            <span>CinemaForge</span>
          </div>
          <span>AI-guided movie creation</span>
        </div>
      </footer>
    </div>
  );
}
