// Ticket Dispenser Component (Thermal Receipt Metaphor)

import { playClickSound, playStampSound } from './audio.js';
import { state, getCopy, saveLocalState } from './storage.js';
import {
  showToast,
  updateStatusBadges,
  renderExclusions,
  openSettingsModal
} from './ui.js';
import { openBlindBoxModal } from './blindbox.js';
import { openDuelModal } from './duel.js';

export function renderTicket(data) {
  const stage = document.getElementById('ticket-stage');
  if (!stage) return;
  stage.classList.remove('hidden');

  // Auto-log to client history if verdict was accepted/logged
  if (data.auto_logged && data.history_entry) {
    state.currentHistory.push(data.history_entry);
    saveLocalState();
  }

  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  let stampMarkup = '';
  let actionButtons = '';
  let probRows = '';

  const stampMap = {
    decisive_pick: getCopy('ticket.stamps.decisive', '拍板落定'),
    soft_pick: getCopy('ticket.stamps.soft', '倾向建议'),
    impasse: getCopy('ticket.stamps.impasse', '神仙难救'),
    indifference: getCopy('ticket.stamps.indifference', '盲盒邀约'),
    dilemma_duel: '势均力敌'
  };
  const stampText = stampMap[data.verdict] || getCopy('ticket.stamps.' + data.verdict, '拍板落定');
  const btnEatText = getCopy('ticket.actions.eat', '去吃！');
  const btnRevokeText = getCopy('ticket.actions.revoke', '撤销并排除');
  const btnRefocusText = getCopy('ticket.actions.refocus', '重新整理需求');
  const btnBlindBoxText = getCopy('ticket.actions.draw_blind_box', '直接抽个盲盒');

  if (data.verdict === 'decisive_pick') {
    stampMarkup = `<div class="stamp-seal decisive">${stampText}</div>`;
    actionButtons = `
      <div class="ticket-actions">
        <button onclick="acceptMeal('${data.primary}')" class="btn-eat">${btnEatText}</button>
        <button onclick="revokeDecision('${data.primary}')" class="btn-revoke">${btnRevokeText}</button>
      </div>
    `;
  } else if (data.verdict === 'soft_pick') {
    stampMarkup = `<div class="stamp-seal soft">${stampText}</div>`;
    actionButtons = `
      <div class="ticket-actions">
        <button onclick="acceptMeal('${data.primary}')" class="btn-eat">${btnEatText}</button>
        <button onclick="revokeDecision('${data.primary}')" class="btn-revoke">${btnRevokeText}</button>
      </div>
    `;
  } else if (data.verdict === 'impasse') {
    stampMarkup = `<div class="stamp-seal impasse">${stampText}</div>`;
    actionButtons = `
      <div style="padding-top: 2px;">
        <button onclick="refocusInput()" class="btn-full">${btnRefocusText}</button>
      </div>
    `;
  } else if (data.verdict === 'indifference') {
    stampMarkup = `<div class="stamp-seal indifference">${stampText}</div>`;
    actionButtons = `
      <div style="padding-top: 2px;">
        <button onclick="openBlindBoxModal()" class="btn-full" style="background: var(--broth-gold);">${btnBlindBoxText}</button>
      </div>
    `;
  } else if (data.verdict === 'dilemma_duel') {
    stampMarkup = `<div class="stamp-seal duel">势均力敌</div>`;
    actionButtons = `
      <div class="ticket-actions">
        <button onclick="acceptMeal('${data.primary}')" class="btn-eat">接受对决，去吃！</button>
        <button onclick="openDuelModal()" class="btn-revoke" style="color: var(--broth-gold); border-color: var(--broth-gold);">查看对决轮盘</button>
      </div>
    `;
  }

  if (data.probabilities && Object.keys(data.probabilities).length > 0) {
    const topPairs = Object.entries(data.probabilities)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k,v]) => `${k}: ${(v*100).toFixed(0)}%`)
      .join('  |  ');
    probRows = `
      <div class="prob-breakdown">
        <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--steel-dark);">
          <span>${(data.model && data.model.startsWith('d1')) || state.currentModel.startsWith('d1') ? 'D1 校准置信度' : getCopy('ticket.labels.confidence', 'JEV 校准置信度')}</span>
          <span>${(data.confidence*100).toFixed(0)}%</span>
        </div>
        <div style="font-size: 10px; color: var(--ink-muted); line-height: 1.3;">
          ${getCopy('ticket.labels.distribution', '候选分布:')} ${topPairs}
        </div>
      </div>
    `;
  }

  const dishTitle = data.primary ? data.primary : (data.verdict === 'impasse' ? '喝杯热水' : '全池随选');

  stage.innerHTML = `
    <div class="ticket-card">
      ${stampMarkup}
      <div class="ticket-header">
        <div class="ticket-brand">${getCopy('ticket.header_brand', '吃什么 · 专属餐券')}</div>
        <div class="ticket-time">${timeStr}</div>
      </div>
      <div class="ticket-verdict-box">
        <div class="verdict-dish">${dishTitle}</div>
        ${data.alternatives && data.alternatives.length > 0 ? `<div class="verdict-alt">${getCopy('ticket.labels.alternatives_prefix', '备选:')} ${data.alternatives.join('、')}</div>` : ''}
      </div>
      <div class="ticket-quote">“${data.message}”</div>
      ${probRows}
      ${actionButtons}
    </div>
  `;

  playStampSound();
  updateStatusBadges();
}

export function acceptMeal(name) {
  playClickSound();
  const toastMsg = getCopy('toasts.accepted', '已选定：【{candidate}】').replace('{candidate}', name);
  showToast(toastMsg);
  document.getElementById('ticket-stage')?.classList.add('hidden');
  const cravingInput = document.getElementById('craving-input');
  if (cravingInput) cravingInput.value = '';
  updateStatusBadges();
}

export function revokeDecision(name) {
  playClickSound();
  if (state.currentHistory.length > 0) {
    state.currentHistory.pop();
    saveLocalState();
  }

  state.currentExclusions.add(name);
  renderExclusions();
  document.getElementById('ticket-stage')?.classList.add('hidden');
  document.getElementById('craving-input')?.focus();

  const toastMsg = getCopy('toasts.revoked', '已撤销【{candidate}】，本次已临时排除').replace('{candidate}', name);
  showToast(toastMsg);
  updateStatusBadges();
}

export function refocusInput() {
  document.getElementById('ticket-stage')?.classList.add('hidden');
  document.getElementById('craving-input')?.focus();
}
