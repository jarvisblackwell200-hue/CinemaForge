import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock child_process ────────────────────────────────────────
let execFileCalls: { cmd: string; args: string[] }[] = [];
let ffprobeResult = { stdout: JSON.stringify({ format: { duration: "5.0" } }), stderr: "" };
let ffmpegShouldThrow = false;
let ffprobeShouldThrow = false;

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
        if (ffprobeShouldThrow) {
          cb(new Error("ffprobe failed"), { stdout: "", stderr: "" });
        } else {
          cb(null, ffprobeResult);
        }
      } else {
        // ffmpeg
        if (ffmpegShouldThrow) {
          cb(new Error("ffmpeg failed"), { stdout: "", stderr: "" });
        } else {
          cb(null, { stdout: "", stderr: "" });
        }
      }
    },
  ),
}));

// ─── Mock fs ──────────────────────────────────────────────────
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => Buffer.from("fake-jpeg-data")),
  unlink: vi.fn(async () => {}),
}));

// ─── Mock Supabase ─────────────────────────────────────────────
let uploadedPath: string | undefined;
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async (path: string) => {
          uploadedPath = path;
          return { error: null };
        }),
        getPublicUrl: vi.fn((path: string) => ({
          data: { publicUrl: `https://mock-supabase.co/storage/${path}` },
        })),
      })),
    },
  })),
}));

import { extractLastFrame, extractFirstFrame, getVideoDuration } from "@/lib/video/frames";

beforeEach(() => {
  execFileCalls = [];
  ffprobeResult = { stdout: JSON.stringify({ format: { duration: "5.0" } }), stderr: "" };
  ffmpegShouldThrow = false;
  ffprobeShouldThrow = false;
  uploadedPath = undefined;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "mock-secret";
});

// ─── getVideoDuration ──────────────────────────────────────────

describe("getVideoDuration", () => {
  it("returns duration from ffprobe output", async () => {
    ffprobeResult = {
      stdout: JSON.stringify({ format: { duration: "5.5" } }),
      stderr: "",
    };
    const duration = await getVideoDuration("https://example.com/video.mp4");
    expect(duration).toBe(5.5);
  });

  it("calls ffprobe with correct arguments", async () => {
    await getVideoDuration("https://example.com/video.mp4");
    expect(execFileCalls[0].cmd).toBe("ffprobe");
    expect(execFileCalls[0].args).toContain("-print_format");
    expect(execFileCalls[0].args).toContain("json");
    expect(execFileCalls[0].args).toContain("https://example.com/video.mp4");
  });

  it("returns 0 when duration is missing", async () => {
    ffprobeResult = {
      stdout: JSON.stringify({ format: {} }),
      stderr: "",
    };
    const duration = await getVideoDuration("https://example.com/video.mp4");
    expect(duration).toBe(0);
  });
});

// ─── extractLastFrame ──────────────────────────────────────────

describe("extractLastFrame", () => {
  it("extracts frame near end of video and returns URL", async () => {
    ffprobeResult = {
      stdout: JSON.stringify({ format: { duration: "8.0" } }),
      stderr: "",
    };

    const result = await extractLastFrame("https://example.com/video.mp4");

    expect(result).not.toBeNull();
    expect(result).toContain("https://mock-supabase.co/storage/frames/last/");
    // Should seek to 7.9 (8.0 - 0.1)
    const ffmpegCall = execFileCalls.find((c) => c.cmd === "ffmpeg");
    expect(ffmpegCall).toBeTruthy();
    const ssIndex = ffmpegCall!.args.indexOf("-ss");
    expect(parseFloat(ffmpegCall!.args[ssIndex + 1])).toBeCloseTo(7.9, 1);
  });

  it("returns null when ffprobe fails", async () => {
    ffprobeShouldThrow = true;
    const result = await extractLastFrame("https://example.com/video.mp4");
    expect(result).toBeNull();
  });

  it("returns null when duration is 0", async () => {
    ffprobeResult = {
      stdout: JSON.stringify({ format: { duration: "0" } }),
      stderr: "",
    };
    const result = await extractLastFrame("https://example.com/video.mp4");
    expect(result).toBeNull();
  });

  it("returns null when ffmpeg extraction fails", async () => {
    ffmpegShouldThrow = true;
    const result = await extractLastFrame("https://example.com/video.mp4");
    expect(result).toBeNull();
  });
});

// ─── extractFirstFrame ──────────────────────────────────────────

describe("extractFirstFrame", () => {
  it("extracts first frame and returns URL", async () => {
    const result = await extractFirstFrame("https://example.com/video.mp4");

    expect(result).not.toBeNull();
    expect(result).toContain("https://mock-supabase.co/storage/frames/first/");
  });

  it("seeks to time 0", async () => {
    await extractFirstFrame("https://example.com/video.mp4");

    const ffmpegCall = execFileCalls.find((c) => c.cmd === "ffmpeg");
    expect(ffmpegCall).toBeTruthy();
    const ssIndex = ffmpegCall!.args.indexOf("-ss");
    expect(ffmpegCall!.args[ssIndex + 1]).toBe("0");
  });

  it("returns null when ffmpeg fails", async () => {
    ffmpegShouldThrow = true;
    const result = await extractFirstFrame("https://example.com/video.mp4");
    expect(result).toBeNull();
  });
});

// ─── Upload behavior ───────────────────────────────────────────

describe("frame upload", () => {
  it("uploads to frames/ prefix in storage bucket", async () => {
    await extractFirstFrame("https://example.com/video.mp4");
    expect(uploadedPath).toMatch(/^frames\/first\/.+\.jpg$/);
  });
});
