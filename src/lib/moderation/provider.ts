import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import * as ort from "onnxruntime-node";
import sharp from "sharp";

import { AppError, NotImplementedError } from "@/lib/errors";

import type {
  ModerationDetection,
  ModerationProvider,
  ModerationResult,
} from "./types";

/**
 * NudeNet ONNX labels (common v2/v3 ordering). Scores above threshold on
 * exposed genitalia / buttocks / breast labels → rejected.
 */
const UNSAFE_LABELS = new Set([
  "FEMALE_GENITALIA_EXPOSED",
  "MALE_GENITALIA_EXPOSED",
  "BUTTOCKS_EXPOSED",
  "FEMALE_BREAST_EXPOSED",
  "ANUS_EXPOSED",
]);

const LABEL_ORDER = [
  "FEMALE_GENITALIA_COVERED",
  "FACE_FEMALE",
  "BUTTOCKS_EXPOSED",
  "FEMALE_BREAST_EXPOSED",
  "FEMALE_GENITALIA_EXPOSED",
  "MALE_BREAST_EXPOSED",
  "ANUS_EXPOSED",
  "FEET_EXPOSED",
  "BELLY_COVERED",
  "FEET_COVERED",
  "ARMPITS_COVERED",
  "ARMPITS_EXPOSED",
  "FACE_MALE",
  "BELLY_EXPOSED",
  "MALE_GENITALIA_EXPOSED",
  "ANUS_COVERED",
  "FEMALE_BREAST_COVERED",
  "BUTTOCKS_COVERED",
];

const SCORE_THRESHOLD = 0.6;
const INPUT_SIZE = 320;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

async function ensureModelFile(): Promise<string> {
  const configured = process.env.NUDENET_MODEL_PATH;
  if (configured) {
    await fs.access(configured);
    return configured;
  }

  const url = process.env.NUDENET_MODEL_URL;
  if (!url) {
    throw new NotImplementedError(
      "NudeNet model not configured. Set NUDENET_MODEL_PATH or NUDENET_MODEL_URL.",
    );
  }

  const tmpDir = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "tmp");
  await fs.mkdir(tmpDir, { recursive: true });
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
  const dest = path.join(tmpDir, `nudenet-${hash}.onnx`);

  try {
    await fs.access(dest);
    return dest;
  } catch {
    const res = await fetch(url);
    if (!res.ok) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to download NudeNet model: ${res.status}`,
        500,
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(dest, buf);
    return dest;
  }
}

async function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const modelPath = await ensureModelFile();
      return ort.InferenceSession.create(modelPath, {
        executionProviders: ["cpu"],
      });
    })().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

async function preprocess(bytes: Buffer): Promise<ort.Tensor> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize(INPUT_SIZE, INPUT_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 3) {
    throw new AppError("VALIDATION_ERROR", "Expected RGB image.", 400);
  }

  // NCHW float32 normalized 0-1
  const float = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
  const hw = INPUT_SIZE * INPUT_SIZE;
  for (let i = 0; i < hw; i += 1) {
    float[i] = data[i * 3]! / 255;
    float[hw + i] = data[i * 3 + 1]! / 255;
    float[2 * hw + i] = data[i * 3 + 2]! / 255;
  }

  return new ort.Tensor("float32", float, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

export class NudeNetProvider implements ModerationProvider {
  readonly name = "nudenet" as const;

  async checkImage(bytes: Buffer, mimeType: string): Promise<ModerationResult> {
    if (!mimeType.startsWith("image/")) {
      throw new AppError("VALIDATION_ERROR", "Only image MIME types allowed.", 400);
    }

    if (bytes.byteLength > 8 * 1024 * 1024) {
      throw new AppError("VALIDATION_ERROR", "Image exceeds 8MB limit.", 400);
    }

    try {
      const session = await getSession();
      const inputName = session.inputNames[0];
      if (!inputName) {
        throw new AppError("INTERNAL_ERROR", "ONNX model has no inputs.", 500);
      }

      const tensor = await preprocess(bytes);
      const output = await session.run({ [inputName]: tensor });
      const firstOut = output[session.outputNames[0] ?? ""];
      if (!firstOut) {
        throw new AppError("INTERNAL_ERROR", "ONNX model returned no output.", 500);
      }

      const scores = Array.from(firstOut.data as Float32Array | number[]);
      const detections: ModerationDetection[] = LABEL_ORDER.map((label, i) => ({
        label,
        score: Number(scores[i] ?? 0),
      }));

      const unsafe = detections.filter(
        (d) => UNSAFE_LABELS.has(String(d.label)) && d.score >= SCORE_THRESHOLD,
      );

      if (unsafe.length > 0) {
        return {
          safe: false,
          reasonCode: "EXPLICIT_NUDITY",
          detections,
          provider: "nudenet",
        };
      }

      return {
        safe: true,
        detections,
        provider: "nudenet",
      };
    } catch (err) {
      // Allow retry after transient ONNX / model load failures
      if (!(err instanceof AppError && err.code === "VALIDATION_ERROR")) {
        sessionPromise = null;
      }
      throw err;
    }
  }
}

export class GoogleVisionProvider implements ModerationProvider {
  readonly name = "google_vision" as const;

  async checkImage(bytes: Buffer, mimeType: string): Promise<ModerationResult> {
    void bytes;
    void mimeType;
    throw new NotImplementedError(
      "Google Vision SafeSearch adapter is not enabled. Switch getModerationProvider() to use it after implementing.",
      { provider: this.name },
    );
  }
}

export class AllowAllModerationProvider implements ModerationProvider {
  readonly name = "allow_all" as const;

  async checkImage(): Promise<ModerationResult> {
    return { safe: true, detections: [], provider: "allow_all" };
  }
}

let cachedProvider: ModerationProvider | undefined;

export function getModerationProvider(): ModerationProvider {
  if (!cachedProvider) {
    const mode = process.env.MODERATION_MODE?.toLowerCase();
    const hasModel =
      Boolean(process.env.NUDENET_MODEL_PATH) ||
      Boolean(process.env.NUDENET_MODEL_URL);

    if (mode === "off") {
      if (process.env.NODE_ENV === "production") {
        console.warn(
          "[moderation] MODERATION_MODE=off in production — uploads are not scanned",
        );
      }
      cachedProvider = new AllowAllModerationProvider();
    } else if (!hasModel && process.env.NODE_ENV !== "production") {
      console.warn(
        "[moderation] NudeNet not configured — allowing uploads in non-production",
      );
      cachedProvider = new AllowAllModerationProvider();
    } else {
      cachedProvider = new NudeNetProvider();
    }
  }
  return cachedProvider;
}
