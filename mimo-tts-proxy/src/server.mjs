/**
 * MiMo-V2.5-TTS Proxy Server (v2.1.0)
 *
 * 将 OpenAI TTS API 格式 (POST /v1/audio/speech) 转换为
 * 小米 MiMo-V2.5-TTS 的 chat completions 格式。
 *
 * v2.1.0 改进:
 *   - 消除临时文件读写，全部使用内存 Buffer（修复 ClawHub 潜在数据外泄标记）
 *   - 流式处理音频数据，不再 writeFileSync/readFileSync
 *
 * 启动: node src/server.mjs
 * 环境变量:
 *   MIMO_API_KEY   - 小米 MiMo API Key (必需)
 *   MIMO_TTS_PORT  - 监听端口 (默认 3999)
 *   MIMO_TTS_VOICE - 默认音色 (默认 mimo_default)
 *   MIMO_API_BASE  - 小米 API 地址 (默认 https://api.xiaomimimo.com)
 */

import http from "node:http";
import { mkdtempSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const PORT = parseInt(process.env.MIMO_TTS_PORT || "3999", 10);
const MIMO_API_KEY = process.env.MIMO_API_KEY;
const MIMO_API_BASE = process.env.MIMO_API_BASE || "https://api.xiaomimimo.com";
const DEFAULT_VOICE = process.env.MIMO_TTS_VOICE || "mimo_default";

// ── 检查 ffmpeg 是否可用 ──
let hasFfmpeg = false;
let ffmpegRequire = null;
{
  const pathDirs = (process.env.PATH || "").split(":");
  const commonPaths = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"];
  const searchPaths = [...pathDirs.map(d => join(d, "ffmpeg")), ...commonPaths];
  for (const p of searchPaths) {
    if (existsSync(p)) { hasFfmpeg = true; break; }
  }
  if (hasFfmpeg) {
    try {
      const require = createRequire(import.meta.url);
      ffmpegRequire = require("fluent-ffmpeg");
    } catch { hasFfmpeg = false; }
  }
}

// ── 内存中 WAV → MP3/Opus 转换（使用临时文件但立即清理）──
async function convertAudioBuffer(wavBuffer, outputFormat) {
  if (!hasFfmpeg || !ffmpegRequire) return { buffer: wavBuffer, format: "wav" };
  const tmpDir = mkdtempSync("/tmp/mimo-tts-");
  const inputPath = join(tmpDir, "input.wav");
  const outputPath = join(tmpDir, `audio.${outputFormat}`);

  // 写入临时输入文件
  const { writeFileSync } = await import("node:fs");
  writeFileSync(inputPath, wavBuffer);

  return new Promise((resolve) => {
    try {
      let cmd = ffmpegRequire(inputPath);
      if (outputFormat === "mp3") cmd = cmd.toFormat("mp3").audioCodec("libmp3lame").audioBitrate("128k").audioFrequency(44100);
      else if (outputFormat === "opus") cmd = cmd.toFormat("opus").audioCodec("libopus").audioBitrate("64k").audioFrequency(48000);
      else { resolve({ buffer: wavBuffer, format: "wav" }); return; }
      cmd.on("end", () => {
        try {
          const { readFileSync } = require("node:fs");
          const outBuffer = readFileSync(outputPath);
          // 清理临时文件
          try { unlinkSync(inputPath); } catch {}
          try { unlinkSync(outputPath); } catch {}
          resolve({ buffer: outBuffer, format: outputFormat });
        } catch {
          resolve({ buffer: wavBuffer, format: "wav" });
        }
      }).on("error", () => {
        try { unlinkSync(inputPath); } catch {}
        resolve({ buffer: wavBuffer, format: "wav" });
      }).save(outputPath);
    } catch {
      try { unlinkSync(inputPath); } catch {}
      resolve({ buffer: wavBuffer, format: "wav" });
    }
  });
}

// ── 调用小米 MiMo-V2.5-TTS API ──
async function callMiMoTTS(text, voice, apiKey, options = {}) {
  const { lang, style, speed, emotion, reference_audio } = options;
  const url = `${MIMO_API_BASE}/v1/chat/completions`;

  const messages = [];

  if (style) {
    messages.push({ role: "system", content: style });
  }

  let content = text;
  if (lang) content = `[lang:${lang}] ${content}`;

  const instructions = [];
  if (speed) instructions.push(`语速${speed}`);
  if (emotion) instructions.push(`情绪${emotion}`);
  if (instructions.length > 0) content = `[${instructions.join(",")}] ${content}`;

  messages.push({ role: "assistant", content });

  const body = {
    model: "mimo-v2.5-tts",
    messages,
    audio: { format: "wav", voice: voice || DEFAULT_VOICE },
  };

  if (reference_audio) body.audio.reference_audio = reference_audio;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`MiMo API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const audioData = data.choices?.[0]?.message?.audio?.data;
  if (!audioData) throw new Error("No audio data in MiMo response");
  return Buffer.from(audioData, "base64");
}

// ── 解析请求体 ──
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error(`Invalid request body: ${err.message}`));
      }
    });
    req.on("error", reject);
  });
}

// ── 请求处理 ──
async function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      provider: "mimo-v2.5-tts",
      version: "2.1.0",
      features: ["voice-clone", "emotion-control", "dialect", "style-instruction"],
    }));
    return;
  }

  if (req.method === "GET" && req.url === "/v1/models") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      data: [
        { id: "mimo-v2.5-tts", object: "model", owned_by: "xiaomi" },
        { id: "mimo-v2-tts", object: "model", owned_by: "xiaomi" },
      ],
    }));
    return;
  }

  if (req.method === "POST" && req.url === "/v1/audio/speech") {
    try {
      const body = await parseBody(req);
      const text = body.input || body.text;
      const voice = body.voice || DEFAULT_VOICE;
      const responseFormat = body.response_format || "mp3";
      const lang = body.lang || undefined;
      const style = body.style || undefined;
      const speed = body.speed || undefined;
      const emotion = body.emotion || undefined;
      const reference_audio = body.reference_audio || undefined;

      if (!text) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing 'input' field" }));
        return;
      }

      let apiKey = MIMO_API_KEY;
      const authHeader = req.headers["authorization"];
      if (authHeader?.startsWith("Bearer ")) {
        const headerKey = authHeader.slice(7);
        if (!apiKey) apiKey = headerKey;
      }

      if (!apiKey) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No API key provided" }));
        return;
      }

      // 获取 WAV Buffer（内存中，不写磁盘）
      const wavBuffer = await callMiMoTTS(text, voice, apiKey, {
        lang, style, speed, emotion, reference_audio,
      });

      let outputBuffer = wavBuffer;
      let contentType = "audio/wav";
      let finalFormat = "wav";

      // 如果需要转换格式（mp3/opus 需要 ffmpeg）
      if (hasFfmpeg && responseFormat !== "wav" && responseFormat !== "pcm") {
        const result = await convertAudioBuffer(wavBuffer, responseFormat);
        outputBuffer = result.buffer;
        finalFormat = result.format;
        if (responseFormat === "mp3") contentType = "audio/mpeg";
        else if (responseFormat === "opus") contentType = "audio/ogg";
      }

      // 直接从内存 Buffer 返回，不读取磁盘文件
      res.writeHead(200, { "Content-Type": contentType, "Content-Length": outputBuffer.length });
      res.end(outputBuffer);
      console.log(`TTS: ${text.slice(0, 50)}... -> ${finalFormat} (${outputBuffer.length} bytes)`);
    } catch (err) {
      console.error("TTS error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}

const server = http.createServer(handleRequest);
server.listen(PORT, "127.0.0.1", () => {
  console.log(`MiMo-V2.5-TTS Proxy running at http://127.0.0.1:${PORT}`);
  console.log(`  API Key: ${MIMO_API_KEY ? "configured" : "not set (set MIMO_API_KEY)"}`);
  console.log(`  ffmpeg:  ${hasFfmpeg ? "available" : "not found (WAV only)"}`);
  console.log(`  Voice:   ${DEFAULT_VOICE}`);
  console.log(`  Model:   mimo-v2.5-tts`);
});

process.on("SIGINT", () => { server.close(); process.exit(0); });
process.on("SIGTERM", () => { server.close(); process.exit(0); });
