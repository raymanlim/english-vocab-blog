import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initBgm } from './lib/bgm';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/* 右下角背景音乐播放器（默认收起、不自动播放；逻辑见 lib/bgm.ts） */
initBgm();
