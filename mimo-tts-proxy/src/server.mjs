/**
 * MiMo-V2.5-TTS Proxy Server (v2.2.0)
 *
 * 将 OpenAI TTS API 格式转换为小米 MiMo-V2.5-TTS 格式。
 *
 * v2.2.0: 彻底消除所有同步文件读取调用，使用 Stream 处理 ffmpeg 输出
 */

import http from "node:http";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

// ── 配置（集中管理，集中配置管理）──
const CONFIG = Object.freeze({
  port: parseInt(process.env.MIMO_TTS_PORT || "3999", 10),
  apiKey: process.env.MIMO_API_KEY || "",
  apiBase: process.env.MIMO_API_BASE || "https://api.xiaomimimo.com",
  defaultVoice: process.env.MIMO_TTS_VOICE || "mimo_default",
});

// ── 检查 ffmpeg ──
let ffmpegConvert = null;
{
  let ffmpegPath = null;
  const pathDirs = (process.env.PATH || "").split(":");
  const commonPaths = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"];
  for (const p of [...pathDirs.map(d => join(d, "ffmpeg")), ...commonPaths]) {
    if (existsSync(p)) { ffmpegPath = p; break; }
  }
  if (ffmpegPath) {
    try {
      const require = createRequire(import.meta.url);
      const ffmpeg = require("fluent-ffmpeg");
      ffmpeg.setFfmpegPath(ffmpegPath);
      ffmpegConvert = (wavBuffer, format) => new Promise((resolve) => {
        const { Readable } = require("stream");
        const chunks = [];
        const stream = Readable.from(wavBuffer);
        ffmpeg(stream)
          .toFormat(format === "mp3" ? "mp3" : "opus")
          .audioCodec(format === "mp3" ? "libmp3lame" : "libopus")
          .audioBitrate(format === "mp3" ? "128k" : "64k")
          .audioFrequency(format === "mp3" ? 44100 : 48000)
          .on("data", (chunk) => chunks.push(chunk))
          .on("end", () => resolve(Buffer.concat(chunks)))
          .on("error", () => resolve(null))
          .pipe();
      });
    } catch { /* ffmpeg not available */ }
  }
}

// ── 调用 MiMo TTS API ──
async function callMiMoTTS(text, voice, options = {}) {
  const { lang, style, speed, emotion, reference_audio } = options;
  const messages = [];
  if (style) messages.push({ role: "system", content: style });

  let content = text;
  if (lang) content = `[lang:${lang}] ${content}`;
  const instructions = [];
  if (speed) instructions.push(`语速${speed}`);
  if (emotion) instructions.push(`情绪${emotion}`);
  if (instructions.length > 0) content = `[${instructions.join(",")}] ${content}`;
  messages.push({ role: "assistant", content });

  const body = { model: "mimo-v2.5-tts", messages, audio: { format: "wav", voice: voice || CONFIG.defaultVoice } };
  if (reference_audio) body.audio.reference_audio = reference_audio;

  const resp = await fetch(`${CONFIG.apiBase}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": CONFIG.apiKey },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`MiMo API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const audioData = data.choices?.[0]?.message?.audio?.data;
  if (!audioData) throw new Error("No audio data in MiMo response");
  return Buffer.from(audioData, "base64");
}

// ── 请求处理 ──
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

async function handleRequest(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", provider: "mimo-v2.5-tts", version: "2.2.0" }));
    return;
  }

  if (req.method === "GET" && req.url === "/v1/models") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [{ id: "mimo-v2.5-tts", object: "model", owned_by: "xiaomi" }] }));
    return;
  }

  if (req.method === "POST" && req.url === "/v1/audio/speech") {
    try {
      const body = await parseBody(req);
      const text = body.input || body.text;
      if (!text) { res.writeHead(400); res.end(JSON.stringify({ error: "Missing 'input'" })); return; }

      // API key: 环境变量优先，Authorization header 作为 fallback
      let apiKey = CONFIG.apiKey;
      const authHeader = req.headers["authorization"];
      if (authHeader?.startsWith("Bearer ") && !apiKey) apiKey = authHeader.slice(7);
      if (!apiKey) { res.writeHead(401); res.end(JSON.stringify({ error: "No API key" })); return; }

      const wavBuffer = await callMiMoTTS(text, body.voice, {
        lang: body.lang, style: body.style, speed: body.speed,
        emotion: body.emotion, reference_audio: body.reference_audio,
      });

      // 格式转换：使用 Stream 管道
      let outputBuffer = wavBuffer;
      let contentType = "audio/wav";
      const fmt = body.response_format || "mp3";
      if (ffmpegConvert && fmt !== "wav" && fmt !== "pcm") {
        const converted = await ffmpegConvert(wavBuffer, fmt);
        if (converted) {
          outputBuffer = converted;
          contentType = fmt === "mp3" ? "audio/mpeg" : "audio/ogg";
        }
      }

      res.writeHead(200, { "Content-Type": contentType, "Content-Length": outputBuffer.length });
      res.end(outputBuffer);
      console.log(`TTS: ${text.slice(0, 40)}... -> ${fmt} (${outputBuffer.length} bytes)`);
    } catch (err) {
      console.error("TTS error:", err.message);
      res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404); res.end(JSON.stringify({ error: "Not found" }));
}

const server = http.createServer(handleRequest);
server.listen(CONFIG.port, "127.0.0.1", () => {
  console.log(`MiMo-V2.5-TTS Proxy v2.2.0 @ http://127.0.0.1:${CONFIG.port}`);
  console.log(`  Key: ${CONFIG.apiKey ? "✓" : "✗"}, ffmpeg: ${ffmpegConvert ? "✓" : "✗"}`);
});
process.on("SIGINT", () => { server.close(); process.exit(0); });
process.on("SIGTERM", () => { server.close(); process.exit(0); });
