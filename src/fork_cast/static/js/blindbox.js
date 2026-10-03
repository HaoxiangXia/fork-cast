// Blind Box Component (Mechanical Slot Reel Drum)

import { playClickSound, playStampSound } from './audio.js';
import { state } from './storage.js';

let onAcceptBlindBoxCallback = null;
let toastHandler = null;

export function setBlindBoxCallbacks({ onAccept, showToast }) {
  onAcceptBlindBoxCallback = onAccept;
  toastHandler = showToast;
}

export function openBlindBoxModal() {
  const modal = document.getElementById('blindbox-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.getElementById('blindbox-result')?.classList.add('hidden');
  document.getElementById('btn-accept-blindbox')?.classList.add('hidden');
  const drum = document.getElementById('blindbox-drum');
  if (drum) drum.innerText = '准备摇号...';
  rollBlindBox();
}

export function closeBlindBoxModal() {
  const modal = document.getElementById('blindbox-modal');
  if (modal) modal.classList.add('hidden');
}

export function rollBlindBox() {
  const drum = document.getElementById('blindbox-drum');
  const acceptBtn = document.getElementById('btn-accept-blindbox');
  const rollBtn = document.getElementById('btn-roll-blindbox');
  if (!drum || !rollBtn) return;

  acceptBtn?.classList.add('hidden');
  rollBtn.disabled = true;

  const available = state.currentCandidates.filter(c => !state.currentExclusions.has(c));
  if (available.length === 0) {
    if (toastHandler) toastHandler('无可用菜品开盲盒');
    rollBtn.disabled = false;
    return;
  }

  const chosen = available[Math.floor(Math.random() * available.length)];
  state.lastBlindBoxDish = chosen;

  // Mechanical slot reel animation
  let steps = 0;
  const maxSteps = 16;

  function reelTick() {
    steps++;
    const tempItem = available[Math.floor(Math.random() * available.length)];
    drum.innerText = tempItem;
    drum.style.transform = `translateY(${steps % 2 === 0 ? '-3px' : '3px'})`;
    playClickSound();

    if (steps < maxSteps) {
      const delay = 40 + Math.pow(steps / maxSteps, 2) * 160;
      setTimeout(reelTick, delay);
    } else {
      drum.style.transform = 'translateY(0)';
      drum.innerText = chosen;
      playStampSound();
      document.getElementById('blindbox-result')?.classList.remove('hidden');
      const dishEl = document.getElementById('blindbox-dish');
      if (dishEl) dishEl.innerText = chosen;
      acceptBtn?.classList.remove('hidden');
      rollBtn.disabled = false;
    }
  }

  reelTick();
}

export function initBlindBox() {
  document.getElementById('btn-open-blindbox')?.addEventListener('click', openBlindBoxModal);
  document.getElementById('btn-roll-blindbox')?.addEventListener('click', rollBlindBox);
  document.getElementById('btn-close-blindbox')?.addEventListener('click', closeBlindBoxModal);
  document.getElementById('btn-close-blindbox-2')?.addEventListener('click', closeBlindBoxModal);
  document.getElementById('btn-accept-blindbox')?.addEventListener('click', () => {
    if (state.lastBlindBoxDish) {
      closeBlindBoxModal();
      if (onAcceptBlindBoxCallback) onAcceptBlindBoxCallback(state.lastBlindBoxDish);
    }
  });
}
