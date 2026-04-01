---
name: mimo-voice-assistant
version: 1.0.2
description: >
  MiMo Voice Assistant — 端到端语音解决方案 for OpenClaw agents.
  Integrates Xiaomi MiMo-V2-TTS with emotion-aware speech generation,
  and MiMo-V2-Omni for voice transcription. Multi-platform ready.
metadata:
  openclaw:
    requires:
      bins: [node, ffmpeg]
      env:
        - MIMO_API_KEY
    install:
      - id: mimo-tts-proxy
        kind: local
        dir: mimo-tts-proxy
        entry: src/server.mjs
---

# 🎤 MiMo Voice Assistant

端到端语音助手 skill。提供 TTS（文字→语音）、STT（语音→文字）和情绪感知功能，
适配 OpenClaw 的所有消息平台。

## 架构

```
用户发语音 → OpenClaw (Telegram/Discord/WhatsApp/...) 
           → STT (MiMo-V2-Omni 转录)
           → Agent 处理
           → TTS (MiMo-V2-TTS, 带情绪)
           → 发送语音消息回平台
```

## 快速开始

### 1. 安装依赖

```bash
cd mimo-tts-proxy
npm install
```

### 2. 配置环境变量

```bash
export MIMO_API_KEY="your-api-key-here"
export MIMO_TTS_PORT=3999
export MIMO_API_BASE="https://api.xiaomimimo.com"  # 可选
```

### 3. 启动 TTS Proxy

```bash
node src/server.mjs
```

健康检查: `curl http://127.0.0.1:3999/health`

### 4. 配置 OpenClaw

在 `openclaw.json` 的 `messages` 部分：

```json
{
  "messages": {
    "tts": {
      "auto": "inbound",
      "provider": "openai",
      "baseUrl": "http://127.0.0.1:3999",
      "maxTextLength": 4000
    }
  }
}
```

> ⚠️ 不要在 skill 文件中硬编码 API Key。
> 使用环境变量或 OpenClaw 配置文件传递密钥。

## 情绪感知语音

详见 `references/emotion-detection.md`

## 多平台支持

详见 `references/platforms.md`

## API 端点

TTS Proxy 提供以下兼容 OpenAI 的端点：

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/v1/models` | GET | 模型列表 |
| `/v1/audio/speech` | POST | 文字转语音 |

### TTS 请求格式

```json
{
  "model": "tts-1",
  "input": "你好，今天天气不错",
  "voice": "mimo_default",
  "response_format": "mp3"
}
```

### 支持的格式

- `wav` (默认)
- `mp3` — 需要 ffmpeg
- `opus` — 需要 ffmpeg

## 安全说明

- API Key 通过环境变量传递，不写入代码
- Proxy 默认绑定 `127.0.0.1`，不对外暴露
- 无外部网络调用（仅连接 MiMo API）
- 所有音频临时文件自动清理

---

*Made with 🎙️ by the MiMo Voice Team*
