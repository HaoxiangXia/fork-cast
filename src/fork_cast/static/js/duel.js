// Duel Wheel Component (Canvas & Easing Physics)

import { playClickSound, playStampSound } from './audio.js';
import { state } from './storage.js';

let wheelSpinning = false;
let onAcceptCallback = null;

export function setDuelAcceptCallback(cb) {
  onAcceptCallback = cb;
}

export function openDuelModal() {
  const modal = document.getElementById('duel-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.getElementById('btn-spin-duel')?.classList.remove('hidden');
  document.getElementById('btn-accept-duel')?.classList.add('hidden');
  document.getElementById('duel-winner-box')?.classList.add('hidden');

  const c0 = state.duelContenders[0] || '选项 A';
  const c1 = state.duelContenders[1] || '选项 B';
  const name0 = document.getElementById('contender-name-0');
  const name1 = document.getElementById('contender-name-1');
  if (name0) name0.innerText = c0;
  if (name1) name1.innerText = c1;

  const card0 = document.getElementById('contender-card-0');
  const card1 = document.getElementById('contender-card-1');
  if (card0) card0.className = 'contender-card';
  if (card1) card1.className = 'contender-card';

  drawWheel(0);
}

export function closeDuelModal() {
  const modal = document.getElementById('duel-modal');
  if (modal) modal.classList.add('hidden');
}

export function drawWheel(rotation) {
  const canvas = document.getElementById('duel-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = cx - 4;
  const n = state.duelContenders.length || 2;
  const arc = (2 * Math.PI) / n;
  const colors = ['#D73318', '#C27911', '#1A241E', '#0284C7'];

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < n; i++) {
    const angle = rotation + i * arc;
    ctx.beginPath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + arc);
    ctx.lineTo(cx, cy);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle + arc / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 14px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(state.duelContenders[i] || `候选 ${i+1}`, r - 16, 5);
    ctx.restore();
  }

  // Center Hub
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#1E2721';
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function spinWheel() {
  if (wheelSpinning) return;
  wheelSpinning = true;
  playClickSound();

  document.getElementById('btn-spin-duel')?.classList.add('hidden');

  const targetIndex = state.duelContenders.indexOf(state.duelWinner);
  const safeIndex = targetIndex >= 0 ? targetIndex : 0;
  const n = state.duelContenders.length || 2;
  const arc = (2 * Math.PI) / n;
  const targetMiddle = -Math.PI / 2 - (safeIndex * arc + arc / 2);
  const totalRotations = 6 * 2 * Math.PI;
  const finalAngle = totalRotations + targetMiddle;

  const duration = 2800;
  const startTime = performance.now();

  function animate(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const currentAngle = ease * finalAngle;

    drawWheel(currentAngle);

    // Alternate contender card pulse during spin
    const card0 = document.getElementById('contender-card-0');
    const card1 = document.getElementById('contender-card-1');
    if (card0 && card1) {
      const tick = Math.floor(elapsed / 120) % 2;
      card0.classList.toggle('active-contender', tick === 0);
      card1.classList.toggle('active-contender', tick === 1);
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      wheelSpinning = false;
      playStampSound();
      document.getElementById('duel-winner-box')?.classList.remove('hidden');
      const winnerEl = document.getElementById('duel-winner-name');
      if (winnerEl) winnerEl.innerText = state.duelWinner;
      document.getElementById('btn-accept-duel')?.classList.remove('hidden');

      if (card0 && card1) {
        const isZeroWinner = (state.duelWinner === (state.duelContenders[0] || ''));
        card0.className = 'contender-card ' + (isZeroWinner ? 'winner' : 'dimmed');
        card1.className = 'contender-card ' + (!isZeroWinner ? 'winner' : 'dimmed');
      }
    }
  }
  requestAnimationFrame(animate);
}

export function initDuel() {
  document.getElementById('btn-spin-duel')?.addEventListener('click', spinWheel);
  document.getElementById('btn-accept-duel')?.addEventListener('click', () => {
    closeDuelModal();
    if (onAcceptCallback) onAcceptCallback();
  });
  document.getElementById('btn-close-duel')?.addEventListener('click', closeDuelModal);
}
