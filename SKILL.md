---
name: mimo-voice-assistant
version: 1.0.6
description: >
  End-to-end voice solution for OpenClaw agents.
  Xiaomi MiMo-V2-TTS with emotion-aware speech generation,
  MiMo-V2-Omni for voice transcription. Multi-platform ready.
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

# MiMo Voice Assistant

TTS (text-to-speech), STT (speech-to-text), and emotion-aware voice generation for OpenClaw agents across all platforms.

## Architecture

```
User voice → OpenClaw (Telegram/Discord/WhatsApp/...)
           → STT (MiMo-V2-Omni transcription)
           → Agent processes
           → TTS (MiMo-V2-TTS with emotion)
           → Voice reply
```

## Quick Start

```bash
# 1. Install dependencies
cd mimo-tts-proxy && npm install

# 2. Set API key
export MIMO_API_KEY="your-key-here"

# 3. Start proxy
node src/server.mjs
```

OpenClaw config (`openclaw.json`):
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

## Emotion Detection

See `references/emotion-detection.md`

## Multi-Platform

See `references/platforms.md`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/v1/models` | GET | Model list |
| `/v1/audio/speech` | POST | Text to speech |

**Request format:**
```json
{"model": "tts-1", "input": "Hello", "voice": "mimo_default", "response_format": "mp3"}
```

**Formats:** `wav` (default), `mp3` (needs ffmpeg), `opus` (needs ffmpeg)

## Language Adaptation

**Default behavior:** Reply in the same language the user uses. No explicit instruction needed.

| User says | Agent replies in |
|-----------|-----------------|
| "你好" | Chinese |
| "Hello" | English |
| "こんにちは" | Japanese |

This applies to both text replies and TTS voice output. If the user explicitly requests a different language, follow their instruction.

## Security

- API key via env var only, never hardcoded
- Proxy binds to `127.0.0.1` (localhost only)
- Temp audio files auto-cleaned
- No third-party data transmission
