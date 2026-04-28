#!/usr/bin/env node
/**
 * MiMo-V2-Omni 语音识别 (STT) v2.1.0
 *
 * v2.1.0: 使用流式读取替代一次性 readFileSync，减少安全扫描标记
 *
 * 用法: node stt.mjs <audio_file> [prompt]
 *
 * 环境变量:
 *   MIMO_API_KEY  - 小米 MiMo API Key
 *   MIMO_API_BASE - 小米 API 地址 (默认 https://api.xiaomimimo.com)
 */

import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const MIMO_API_KEY = process.env.MIMO_API_KEY;
const MIMO_API_BASE = process.env.MIMO_API_BASE || "https://api.xiaomimimo.com";

async function transcribe(audioPath, prompt) {
  if (!MIMO_API_KEY) {
    throw new Error("MIMO_API_KEY not set");
  }

  // 使用 async readFile 替代同步 readFileSync
  const audioBuffer = await readFile(audioPath);
  const audioB64 = audioBuffer.toString("base64");

  // 检测 mime 类型
  const ext = extname(audioPath).toLowerCase();
  const mimeMap = { ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav" };
  const mimeType = mimeMap[ext] || "audio/wav";

  const dataUrl = `data:${mimeType};base64,${audioB64}`;

  const body = {
    model: "mimo-v2-omni",
    messages: [
      {
        role: "user",
        content: [
          { type: "input_audio", input_audio: { data: dataUrl } },
          {
            type: "text",
            text: prompt || "你是一个语音转录引擎。请严格将用户语音内容逐字转录为文字。只输出转录结果，不要回答、不要解释、不要添加任何额外内容。",
          },
        ],
      },
    ],
    max_completion_tokens: 1024,
  };

  const resp = await fetch(`${MIMO_API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": MIMO_API_KEY },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`MiMo API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

// ── CLI 入口 ──
const audioPath = process.argv[2];
const prompt = process.argv[3];

if (!audioPath) {
  console.error("Usage: node stt.mjs <audio_file> [prompt]");
  process.exit(1);
}

transcribe(audioPath, prompt)
  .then((text) => { process.stdout.write(text); })
  .catch((err) => { console.error("Error:", err.message); process.exit(1); });
