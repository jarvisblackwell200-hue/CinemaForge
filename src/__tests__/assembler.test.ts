import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock child_process ────────────────────────────────────────
let execFileCalls: { cmd: string; args: string[] }[] = [];

vi.mock("node:child_process", () => ({
  execFile: vi.fn(
    (
      cmd: string,
      args: string[],
      _opts: unknown,
      cb: (err: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
      execFileCalls.push({ cmd, args });
      if (cmd === "ffprobe") {
        cb(null, {
          stdout: JSON.stringify({ format: { duration: "15.0" } }),
          stderr: "",
        });
      } else {
        cb(null, { stdout: "", stderr: "" });
      }
    },
  ),
}));

// ─── Mock fs ──────────────────────────────────────────────────
let writtenFiles: Map<string, Buffer | string> = new Map();

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => {}),
  writeFile: vi.fn(async (path: string, data: Buffer | string) => {
    writtenFiles.set(path, data);
  }),
  readFile: vi.fn(async () => Buffer.from("fake-mp4-data")),
  unlink: vi.fn(async () => {}),
  readdir: vi.fn(async () => []),
}));

// ─── Mock fetch ────────────────────────────────────────────────
const originalFetch = globalThis.fetch;

// ─── Mock Supabase ─────────────────────────────────────────────
let uploadedData: { path: string; contentType: string } | undefined;

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async (path: string, _buffer: Buffer, opts: { contentType: string }) => {
          uploadedData = { path, contentType: opts.contentType };
          return { error: null };
        }),
        getPublicUrl: vi.fn((path: string) => ({
          data: { publicUrl: `https://mock-supabase.co/storage/${path}` },
        })),
      })),
    },
  })),
}));

import { assembleMovie } from "@/lib/video/assembler";
import type { AssemblyOptions } from "@/lib/video/assembler";

beforeEach(() => {
  execFileCalls = [];
  writtenFiles = new Map();
  uploadedData = undefined;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "mock-secret";

  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(1024),
  })) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ─── assembleMovie ─────────────────────────────────────────────

describe("assembleMovie", () => {
  const baseOptions: AssemblyOptions = {
    clips: [
      { videoUrl: "https://example.com/clip1.mp4", durationSeconds: 5 },
      { videoUrl: "https://example.com/clip2.mp4", durationSeconds: 8 },
    ],
  };

  it("throws on empty clips array", async () => {
    await expect(assembleMovie({ clips: [] })).rejects.toThrow("No clips to assemble");
  });

  it("downloads all clips", async () => {
    await assembleMovie(baseOptions);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("uses ffmpeg concat demuxer for cut-only transitions", async () => {
    await assembleMovie(baseOptions);

    const ffmpegCall = execFileCalls.find(
      (c) => c.cmd === "ffmpeg" && c.args.includes("-f") && c.args.includes("concat"),
    );
    expect(ffmpegCall).toBeTruthy();
    expect(ffmpegCall!.args).toContain("-c");
    expect(ffmpegCall!.args).toContain("copy");
  });

  it("creates concat file listing all clips", async () => {
    await assembleMovie(baseOptions);

    const concatFile = Array.from(writtenFiles.entries()).find(([key]) =>
      key.includes("concat.txt"),
    );
    expect(concatFile).toBeTruthy();
    const content = concatFile![1] as string;
    expect(content).toContain("clip-0");
    expect(content).toContain("clip-1");
  });

  it("uses xfade filter for crossfade transitions", async () => {
    await assembleMovie({
      ...baseOptions,
      transitions: [{ type: "crossfade", durationMs: 500 }],
    });

    const ffmpegCall = execFileCalls.find(
      (c) => c.cmd === "ffmpeg" && c.args.some((a) => a.includes("xfade")),
    );
    expect(ffmpegCall).toBeTruthy();
  });

  it("uploads assembled video to Supabase", async () => {
    await assembleMovie(baseOptions);

    expect(uploadedData).toBeTruthy();
    expect(uploadedData!.contentType).toBe("video/mp4");
    expect(uploadedData!.path).toMatch(/^assembled\/.+\.mp4$/);
  });

  it("returns video URL, file size, and duration", async () => {
    const result = await assembleMovie(baseOptions);

    expect(result.videoUrl).toContain("https://mock-supabase.co/storage/assembled/");
    expect(result.fileSize).toBeGreaterThan(0);
    expect(result.durationSeconds).toBe(15);
  });

  it("uses custom output name", async () => {
    await assembleMovie({
      ...baseOptions,
      outputName: "my-movie",
    });

    expect(uploadedData!.path).toContain("my-movie");
  });

  it("handles single clip without transitions", async () => {
    const result = await assembleMovie({
      clips: [{ videoUrl: "https://example.com/clip.mp4", durationSeconds: 5 }],
    });

    expect(result.videoUrl).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("adds faststart flag for streaming", async () => {
    await assembleMovie(baseOptions);

    const ffmpegCall = execFileCalls.find((c) => c.cmd === "ffmpeg");
    expect(ffmpegCall!.args).toContain("+faststart");
  });
});
