/**
 * 右下角背景音乐播放器（「一处安静的地方 A Quiet Place」）
 *
 * 与经典书库（Classics Library）同一套交互契约：
 *  - 默认收起、默认不播放；只有用户点击才播放（浏览器自动播放策略 +
 *    尊重访客选择，不做任何 autoplay 尝试）。
 *  - 面板开合、音量、播放位置写入 localStorage（键 vocab-bgm）；
 *    页面切换（hash 路由）后恢复进度，但仍不自动播放，避免翻页时突然出声。
 *  - 渐进增强：DOM 在 index.html 中以 hidden 渲染，JS 初始化成功后才显露；
 *    禁用 JS 时不留下无效按钮。
 *  - 悬停 / 聚焦时只取元数据（preload=none → metadata），不下载整曲。
 *
 * 本站是纯中文站（无 i18n 框架），文案直接写在 index.html 的 DOM 里。
 */

type BgmState = {
  volume?: number;
  time?: number;
  open?: boolean;
  muted?: boolean;
};

const LS_KEY = "vocab-bgm";

function $(sel: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector(sel);
}

function readJSON(key: string, fallback: BgmState): BgmState {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as BgmState) : fallback;
  } catch {
    return fallback;
  }
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function initBgm(): void {
  /* DOM 由 index.html 静态保证存在；集中判空后统一用非空断言，
     避免 strict 空值检查对后续每个引用的投诉 */
  const root = $("[data-bgm]") as HTMLElement;
  if (!root) return;
  const audio = $("#bgm-audio", root) as HTMLAudioElement;
  const toggle = $("[data-bgm-toggle]", root) as HTMLButtonElement;
  const panel = $("#bgm-panel", root) as HTMLElement;
  const closeBtn = $("[data-bgm-close]", root) as HTMLButtonElement;
  const playBtn = $("[data-bgm-play]", root) as HTMLButtonElement;
  const muteBtn = $("[data-bgm-mute]", root) as HTMLButtonElement;
  const seek = $("[data-bgm-seek]", root) as HTMLInputElement;
  const volume = $("[data-bgm-volume]", root) as HTMLInputElement;
  const curEl = $("[data-bgm-current]", root) as HTMLElement;
  const totalEl = $("[data-bgm-total]", root) as HTMLElement;
  if (!audio || !toggle || !panel || !playBtn || !muteBtn || !seek || !volume) return;

  const state = readJSON(LS_KEY, {});
  const vol =
    typeof state.volume === "number" && state.volume >= 0 && state.volume <= 1
      ? state.volume
      : 0.35;
  const savedTime = typeof state.time === "number" && state.time > 0 ? state.time : 0;
  let restored = false;
  let lastSave = 0;

  /* 恢复播放位置：loadedmetadata 可能因 play() 隐式 load 而先于本监听绑定触发，
     两种时序都覆盖——事件晚到走 addEventListener，已触发则 loadedmetadata 后立即恢复 */
  function restoreProgress(): void {
    if (restored) return;
    restored = true;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    if (savedTime > 0 && savedTime < audio.duration - 1) {
      try {
        audio.currentTime = savedTime;
      } catch {
        /* 忽略不可寻址的流 */
      }
    }
  }

  function save(): void {
    const next: BgmState = {
      volume: audio.volume,
      time: audio.currentTime || 0,
      open: !panel.hidden,
      muted: audio.muted,
    };
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* 隐私模式等场景静默降级 */
    }
  }
  function syncPlay(): void {
    const playing = !audio.paused && !audio.ended;
    root.classList.toggle("is-playing", playing);
    playBtn.setAttribute(
      "aria-label",
      playing ? (playBtn.dataset.labelPause ?? "") : (playBtn.dataset.labelPlay ?? ""),
    );
    playBtn.setAttribute("aria-pressed", playing ? "true" : "false");
  }
  function syncMute(): void {
    const muted = audio.muted || audio.volume === 0;
    root.classList.toggle("is-muted", muted);
    muteBtn.setAttribute(
      "aria-label",
      muted ? (muteBtn.dataset.labelUnmute ?? "") : (muteBtn.dataset.labelMute ?? ""),
    );
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  }
  function play(): void {
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(() => syncPlay());
  }
  function openPanel(shouldPlay: boolean): void {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    /* shouldPlay 时仅在音频从未开始播放时起播：
       若用户主动暂停过，展开面板不强行续播，由用户按播放键决定 */
    if (shouldPlay && audio.paused && audio.currentTime === 0) play();
    save();
  }
  function closePanel(): void {
    /* 收起控制台 ≠ 暂停：关闭面板只隐藏 UI，播放继续；
       只有面板内暂停键（或再次点击播放键）才停止 */
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    save();
  }
  /* 悬停 / 聚焦时只取元数据，提前恢复进度，不播放、不下载整曲 */
  function prefetch(): void {
    if (audio.preload === "none") {
      audio.preload = "metadata";
      audio.load();
    }
  }

  audio.volume = vol;
  audio.muted = !!state.muted;
  volume.value = String(vol);
  volume.style.setProperty("--bgm-vol", `${vol * 100}%`);
  syncPlay();
  syncMute();

  audio.addEventListener("loadedmetadata", () => {
    if (totalEl) totalEl.textContent = fmt(audio.duration);
    restoreProgress();
  });
  /* 音频元数据可能已在绑定前加载完成（preload=metadata 或 play 隐式 load） */
  if (audio.readyState >= 1) restoreProgress();
  audio.addEventListener("timeupdate", () => {
    const dur = audio.duration || 0;
    const pct = dur ? (audio.currentTime / dur) * 100 : 0;
    seek.value = String(pct);
    seek.style.setProperty("--bgm-progress", `${pct}%`);
    if (curEl) curEl.textContent = fmt(audio.currentTime);
    if (Date.now() - lastSave > 5000) {
      lastSave = Date.now();
      save();
    }
  });
  audio.addEventListener("play", syncPlay);
  audio.addEventListener("pause", () => {
    syncPlay();
    save();
  });
  audio.addEventListener("volumechange", () => {
    volume.style.setProperty("--bgm-vol", `${audio.volume * 100}%`);
    syncMute();
  });

  toggle.addEventListener("click", () => {
    if (panel.hidden) openPanel(true);
    else closePanel();
  });
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  playBtn.addEventListener("click", () => {
    if (audio.paused) play();
    else audio.pause();
  });
  muteBtn.addEventListener("click", () => {
    audio.muted = !audio.muted;
    save();
  });
  seek.addEventListener("input", () => {
    if (!audio.duration) return;
    const pct = Number(seek.value);
    audio.currentTime = (pct / 100) * audio.duration;
    seek.style.setProperty("--bgm-progress", `${pct}%`);
    if (curEl) curEl.textContent = fmt(audio.currentTime);
  });
  volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    if (audio.volume > 0) audio.muted = false;
    save();
  });
  toggle.addEventListener("mouseenter", prefetch, { once: true });
  toggle.addEventListener("focus", prefetch, { once: true });
  document.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Escape" && !panel.hidden) {
      closePanel();
      toggle.focus();
    }
  });
  window.addEventListener("pagehide", save);

  /* 渐进增强：JS 可用时才显露组件；记住面板开合，但绝不自动播放 */
  root.hidden = false;
  if (state.open) {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
  }
}
