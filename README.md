# 🎤 MiMo Voice Assistant

端到端语音助手 Skill for [OpenClaw](https://github.com/openclaw/openclaw) agents。

集成 [Xiaomi MiMo-V2-TTS](https://github.com/xiaomi) 和 MiMo-V2-Omni，提供情绪感知 TTS 和 STT 能力，支持多平台。

## ✨ 功能

- **TTS (文字→语音)** — OpenAI 兼容格式，MiMo-V2-TTS
- **STT (语音→文字)** — MiMo-V2-Omni 语音转录
- **🎭 情绪感知** — 8 种情绪自动判断（开心/平静/难过/生气/激动/紧张/思考/温柔）
- **🌐 多平台** — Telegram / Discord / WhatsApp / iMessage / Slack / Line

## 📦 安装

```bash
# 通过 ClawHub 安装
clawhub install mimo-voice-assistant

# 或手动克隆
git clone https://github.com/Nciae-Zyh/mimo-voice-assistant.git
cd mimo-voice-assistant/mimo-tts-proxy
npm install
```

## 🚀 快速开始

### 1. 配置环境变量

```bash
export MIMO_API_KEY="your-api-key-here"
export MIMO_TTS_PORT=3999
```

### 2. 启动 TTS Proxy

```bash
cd mimo-tts-proxy
node src/server.mjs
```

### 3. 配置 OpenClaw

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

## 📁 项目结构

```
mimo-voice-assistant/
├── SKILL.md                          # OpenClaw skill 主文档
├── _meta.json                        # ClawHub 元数据
├── README.md                         # 本文件
├── mimo-tts-proxy/
│   ├── package.json
│   └── src/
│       ├── server.mjs                # TTS Proxy (OpenAI 兼容)
│       └── stt.mjs                   # 语音转录工具
├── references/
│   ├── emotion-detection.md          # 情绪检测详细指南
│   └── platforms.md                  # 多平台适配指南
└── scripts/
    └── detect-emotion.mjs            # 情绪检测工具
```

## 📄 License

MIT
