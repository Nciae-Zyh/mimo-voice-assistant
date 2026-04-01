#!/usr/bin/env node
/**
 * 情绪检测工具 — 文本情绪分析
 *
 * 用法: node detect-emotion.mjs "你的文本内容"
 * 输出: JSON { emotion, intensity, confidence }
 *
 * 无任何外部依赖，纯规则 + 关键词匹配。
 */

const text = process.argv[2];

if (!text) {
  console.error('Usage: node detect-emotion.mjs "text to analyze"');
  process.exit(1);
}

// ── 情绪关键词库 ─────────────────────────────────────────────
const emotionPatterns = {
  excited: {
    keywords: [
      "太好了", "太棒了", "厉害", "了不起", "不可思议", "惊了",
      "哇", "天哪", "竟然", "居然", "简直", "绝了", "完美",
      "🎉", "🥳", "🤯", "😱", "wow", "amazing", "awesome", "incredible",
    ],
    punctuation: /[!！]{2,}/,
    weight: 1.2,
  },
  happy: {
    keywords: [
      "好的", "不错", "好", "哈哈", "嘿嘿", "开心", "高兴",
      "谢谢", "感谢", "恭喜", "祝贺", "优秀", "漂亮",
      "👍", "❤️", "😊", "😄", "🙂", "great", "nice", "good",
    ],
    punctuation: /[!！]{1,2}$/,
    weight: 1.1,
  },
  sad: {
    keywords: [
      "抱歉", "对不起", "可惜", "遗憾", "难过", "伤心",
      "做不到", "无法", "不行", "失败", "丢失", "没了",
      "😢", "😭", "💔", "sorry", "unfortunately", "sadly",
    ],
    punctuation: /[.。]{2,}|…{2,}|[…]{3,}/,
    weight: 0.85,
  },
  angry: {
    keywords: [
      "不对", "错误", "禁止", "警告", "绝不", "不允许",
      "你怎么能", "太过分", "不能这样", "住手",
      "😤", "😡", "🤬", "wrong", "forbidden", "stop",
    ],
    punctuation: /[!！]{3,}/,
    weight: 1.25,
  },
  anxious: {
    keywords: [
      "紧急", "注意", "马上", "立刻", "快点", "危险",
      "小心", "当心", "赶紧", "尽快", "立即",
      "⚠️", "🚨", "⏰", "urgent", "danger", "careful",
    ],
    punctuation: /[!！]/,
    weight: 1.1,
  },
  gentle: {
    keywords: [
      "别担心", "没关系", "慢慢来", "不着急", "放心",
      "加油", "我在这里", "陪着你", "没事的", "会好的",
      "💕", "🤗", "🫂", "hug", "worry", "care",
    ],
    punctuation: /[~～]{1,}$/,
    weight: 0.9,
  },
  thoughtful: {
    keywords: [
      "让我想想", "嗯", "这个嘛", "首先", "其次",
      "从逻辑上", "分析", "考虑", "权衡", "决策",
      "hmm", "let me think", "actually",
    ],
    punctuation: /[?？]/,
    weight: 0.95,
  },
};

// ── 检测逻辑 ────────────────────────────────────────────────
function detectEmotion(text) {
  const scores = {};

  for (const [emotion, config] of Object.entries(emotionPatterns)) {
    scores[emotion] = 0;

    // 关键词匹配
    for (const kw of config.keywords) {
      if (text.includes(kw)) {
        scores[emotion] += 1;
      }
    }

    // 标点符号
    if (config.punctuation.test(text)) {
      scores[emotion] += 0.5;
    }
  }

  // 找最高分
  let best = "neutral";
  let bestScore = 0;
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = emotion;
    }
  }

  // 计算置信度 (0-1)
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = total > 0 ? Math.min(bestScore / total, 1) : 0;

  // 语速系数
  const intensity = emotionPatterns[best]?.weight || 1.0;

  return {
    emotion: best,
    confidence: Math.round(confidence * 100) / 100,
    speedFactor: intensity,
    scores,
  };
}

// ── 执行 ────────────────────────────────────────────────────
const result = detectEmotion(text);
console.log(JSON.stringify(result, null, 2));
