#!/usr/bin/env node
/**
 * MiMo-V2-Omni 语音识别 (STT) v2.2.0
 *
 * v2.2.0: 集中配置管理，最小化 process.env 散布
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";

// 集中配置：减少 process.env 在代码中的散布
const API_KEY = process.env.MIMO_API_KEY || "";
const API_BASE = process.env.MIMO_API_BASE || "https://api.xiaomimimo.com";

async function transcribe(audioPath, prompt) {
  if (!API_KEY) throw new Error("MIMO_API_KEY not set");

  const audioBuffer = await readFile(audioPath);
  const audioB64 = audioBuffer.toString("base64");

  const ext = extname(audioPath).toLowerCase();
  const mimeMap = { ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav" };
  const mimeType = mimeMap[ext] || "audio/wav";

  const resp = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": API_KEY },
    body: JSON.stringify({
      model: "mimo-v2-omni",
      messages: [{
        role: "user",
        content: [
          { type: "input_audio", input_audio: { data: `data:${mimeType};base64,${audioB64}` } },
          { type: "text", text: prompt || "你是一个语音转录引擎。请严格将用户语音内容逐字转录为文字。只输出转录结果。" },
        ],
      }],
      max_completion_tokens: 1024,
    }),
  });

  if (!resp.ok) throw new Error(`MiMo API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

const audioPath = process.argv[2];
if (!audioPath) { console.error("Usage: node stt.mjs <audio_file> [prompt]"); process.exit(1); }

transcribe(audioPath, process.argv[3])
  .then((t) => process.stdout.write(t))
  .catch((e) => { console.error("Error:", e.message); process.exit(1); });
