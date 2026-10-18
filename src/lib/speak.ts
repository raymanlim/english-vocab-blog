// speak.ts — 单词与例句的英文语音（Web Speech API，零依赖）
//
// 设计要点：
//   1. 用浏览器原生 speechSynthesis，不引入音频文件/第三方 TTS，
//      构建产物体积零增长，适合纯静态站。
//   2. 声音加载是异步的（voiceschanged），统一在 useVoices 里订阅，
//      第一次拿不到就等事件，拿到后组件刷新。
//   3. 选 voice 的策略：优先 en-US，其次任意 en-*；都没有就用默认
//      （不阻塞功能，只是口音可能跑偏）。
//   4. 单例播放：点新按钮先 cancel 旧的，避免重叠嗡嗡声。
//   5. SSR 安全：只在浏览器里碰 speechSynthesis。

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function pickEnVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
  if (!en.length) return voices[0];
  const us = en.find((v) => v.lang.toLowerCase() === 'en-us');
  return us ?? en[0];
}

export function speak(text: string, voice: SpeechSynthesisVoice | null): void {
  if (!isSpeechSupported() || !text.trim()) return;
  window.speechSynthesis.cancel(); // 单例：打断上一句，避免重叠
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? 'en-US';
  if (voice) u.voice = voice;
  u.rate = 0.95; // 例句稍慢一点，便于跟读；单词不靠语速区分
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}

// ---- React Hook：订阅声音列表变化 ----
// voices 初次拿到的时机不固定（Chrome 异步加载），统一在这里处理，
// 组件只管拿 voices 状态，不自己监听事件。

import { useEffect, useState } from 'react';

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!isSpeechSupported()) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) setVoices(v);
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  return voices;
}
