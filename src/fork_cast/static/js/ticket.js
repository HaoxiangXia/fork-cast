// Ticket Dispenser Component (Thermal Receipt Metaphor)

import { playClickSound, playStampSound } from './audio.js';
import { state, getCopy, saveLocalState } from './storage.js';
import { createQRCodeSVG } from './qrcode.js';
import {
  showToast,
  updateStatusBadges,
  renderExclusions,
  openSettingsModal
} from './ui.js';
import { openBlindBoxModal } from './blindbox.js';
import { openDuelModal } from './duel.js';

let lastDecisionData = null;
export function renderTicket(data) {
  const stage = document.getElementById('ticket-stage');
  if (!stage) return;
  stage.classList.remove('hidden');

  // Auto-log to client history if verdict was accepted/logged
  if (data.auto_logged && data.history_entry) {
    state.currentHistory.push(data.history_entry);
    saveLocalState();
  }

  lastDecisionData = data;
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  const serialNo = `FC-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(1000 + Math.random()*9000)}`;

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
  const btnShareText = getCopy('ticket.actions.share', '分享餐券');
  const btnRevokeText = getCopy('ticket.actions.revoke', '撤销并排除');
  const btnRefocusText = getCopy('ticket.actions.refocus', '重新整理需求');
  const btnBlindBoxText = getCopy('ticket.actions.draw_blind_box', '直接抽个盲盒');
  const dishTitle = data.primary ? data.primary : (data.verdict === 'impasse' ? '喝杯热水' : '全池随选');
  const shareUrl = `${window.location.origin}${window.location.pathname}?share=1&dish=${encodeURIComponent(dishTitle)}`;
  const qrSvg = createQRCodeSVG(shareUrl, 56);

  if (data.verdict === 'decisive_pick' || data.verdict === 'soft_pick') {
    stampMarkup = `<div class="stamp-seal ${data.verdict === 'soft_pick' ? 'soft' : 'decisive'}">${stampText}</div>`;
    actionButtons = `
      <button onclick="acceptMeal('${dishTitle}')" class="btn-eat">${btnEatText}</button>
      <button type="button" onclick="openShareModal()" class="btn-share-ticket">${btnShareText}</button>
      <button onclick="revokeDecision('${dishTitle}')" class="btn-revoke">${btnRevokeText}</button>
    `;
  } else if (data.verdict === 'impasse') {
    stampMarkup = `<div class="stamp-seal impasse">${stampText}</div>`;
    actionButtons = `
      <button onclick="refocusInput()" class="btn-eat" style="background: var(--steel-dark); flex: 1;">${btnRefocusText}</button>
      <button type="button" onclick="openShareModal()" class="btn-share-ticket" style="flex: 1;">${btnShareText}</button>
    `;
  } else if (data.verdict === 'indifference') {
    stampMarkup = `<div class="stamp-seal indifference">${stampText}</div>`;
    actionButtons = `
      <button onclick="openBlindBoxModal()" class="btn-eat" style="background: var(--broth-gold); flex: 1;">${btnBlindBoxText}</button>
      <button type="button" onclick="openShareModal()" class="btn-share-ticket" style="flex: 1;">${btnShareText}</button>
    `;
  } else if (data.verdict === 'dilemma_duel') {
    stampMarkup = `<div class="stamp-seal duel">势均力敌</div>`;
    actionButtons = `
      <button onclick="acceptMeal('${dishTitle}')" class="btn-eat">${getCopy('ticket.actions.accept_duel', '接受对决，去吃！')}</button>
      <button type="button" onclick="openShareModal()" class="btn-share-ticket">${btnShareText}</button>
      <button onclick="openDuelModal()" class="btn-revoke" style="color: var(--broth-gold); border-color: var(--broth-gold);">${getCopy('ticket.actions.view_duel', '查看对决轮盘')}</button>
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

  stage.innerHTML = `
    <div class="ticket-assembly">
      <div class="ticket-paper-card">
        <div class="ticket-paper">
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
          <div class="receipt-footer-section">
            <div class="receipt-qr-row">
              <div class="receipt-qr-box">${qrSvg}</div>
              <div class="receipt-qr-meta">
                <div class="receipt-serial">${getCopy('ticket.labels.serial_prefix', 'NO. ')}${serialNo}</div>
                <div class="receipt-qr-title">${getCopy('ticket.labels.qr_title', '扫码核验 · 查看同款决策')}</div>
                <div class="receipt-qr-sub">${getCopy('ticket.labels.qr_sub', '吃什么 · 随性就餐决策机')}</div>
                <div class="receipt-engine-tag">${getCopy('ticket.labels.qr_tag', 'SYSTEM 1 MODEL PROBABILISTIC PICK')}</div>
              </div>
            </div>
            <div class="receipt-notice">${getCopy('ticket.labels.notice', '※ 凭此券准时就餐 · 建议趁热享用 ※')}</div>
          </div>
        </div>
        <svg class="ticket-zigzag-svg" height="10">
          <defs>
            <pattern id="sawtooth-pattern" width="16" height="10" patternUnits="userSpaceOnUse">
              <polygon points="0,0 8,8 16,0" fill="#FFFFFF"/>
              <polyline points="0,0 8,8 16,0" fill="none" stroke="#1E2721" stroke-width="2"/>
            </pattern>
          </defs>
          <rect width="100%" height="2" fill="#FFFFFF"/>
          <rect width="100%" height="10" fill="url(#sawtooth-pattern)"/>
        </svg>
      </div>
      <div class="ticket-controls">
        ${actionButtons}
      </div>
    </div>
  `;

  playStampSound();
  updateStatusBadges();
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

export function openShareModal() {
  const modal = document.getElementById('share-modal');
  if (!modal) return;
  const stage = document.getElementById('share-preview-stage');
  const paperCard = document.querySelector('.ticket-paper-card');
  if (stage && paperCard) {
    stage.innerHTML = paperCard.outerHTML;
  }
  modal.classList.remove('hidden');
}

export function closeShareModal() {
  const modal = document.getElementById('share-modal');
  if (modal) modal.classList.add('hidden');
}

export function copyShareLink() {
  if (!lastDecisionData) return;
  const dish = lastDecisionData.primary || '就餐决策';
  const url = `${window.location.origin}${window.location.pathname}?share=1&dish=${encodeURIComponent(dish)}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast(getCopy('toasts.link_copied', '分享链接已复制到剪贴板！'));
    }).catch(() => {
      prompt('长按复制分享链接：', url);
    });
  } else {
    prompt('长按复制分享链接：', url);
  }
}

export function saveShareImage() {
  if (!lastDecisionData) return;
  const dish = lastDecisionData.primary || '就餐决策';
  const msg = lastDecisionData.message || '';
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const canvas = document.createElement('canvas');
  const w = 480;
  const h = 640;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Background tile
  ctx.fillStyle = '#D1DCD6';
  ctx.fillRect(0, 0, w, h);

  // Ticket shadow
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(44, 44, 392, 536);

  // Ticket paper body
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(40, 40, 400, 510);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1E2721';
  ctx.strokeRect(40, 40, 400, 510);

  // Stamp seal
  ctx.save();
  ctx.translate(340, 85);
  ctx.rotate(-8 * Math.PI / 180);
  ctx.strokeStyle = '#D73318';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-50, -16, 100, 32);
  ctx.fillStyle = '#D73318';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('拍板落定', 0, 0);
  ctx.restore();

  // Header
  ctx.fillStyle = '#6B7280';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('吃什么 · 专属餐券', 240, 75);
  ctx.font = '11px monospace';
  ctx.fillStyle = '#59675F';
  ctx.fillText(timeStr, 240, 95);

  // Dashed divider
  ctx.strokeStyle = '#D1D5DB';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(60, 115);
  ctx.lineTo(420, 115);
  ctx.stroke();
  ctx.setLineDash([]);

  // Dish Title
  ctx.fillStyle = '#141A16';
  ctx.font = '900 36px sans-serif';
  ctx.fillText(dish, 240, 175);

  // Quote Box
  ctx.fillStyle = '#F9FAFB';
  ctx.fillRect(60, 210, 360, 54);
  ctx.strokeStyle = '#1E2721';
  ctx.lineWidth = 1;
  ctx.strokeRect(60, 210, 360, 54);
  ctx.fillStyle = '#374151';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  const displayMsg = msg.length > 22 ? msg.slice(0, 22) + '...' : msg;
  ctx.fillText('“' + displayMsg + '”', 75, 242);

  // Serial Number
  ctx.fillStyle = '#1E2721';
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('NO. ' + ('FC-' + now.getFullYear() + '8848'), 60, 305);

  // Notice
  ctx.fillStyle = '#59675F';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('※ 凭此券准时就餐 · 扫码测测今天吃什么 ※', 240, 480);
  ctx.font = '10px monospace';
  ctx.fillText('FORK-CAST DECISION ENGINE · OPEN SOURCE', 240, 502);

  // Sawtooth bottom
  ctx.fillStyle = '#D1DCD6';
  ctx.beginPath();
  ctx.moveTo(40, 550);
  for (let sx = 40; sx <= 440; sx += 16) {
    ctx.lineTo(sx + 8, 538);
    ctx.lineTo(sx + 16, 550);
  }
  ctx.lineTo(440, 600);
  ctx.lineTo(40, 600);
  ctx.closePath();
  ctx.fill();

  const a = document.createElement('a');
  a.download = `fork-cast-${dish}.png`;
  a.href = canvas.toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  showToast(getCopy('toasts.image_downloaded', '餐券图片已下载！'));
}

export function renderSharedBanner(dish, quote) {
  const container = document.getElementById('shared-banner-container');
  if (!container) return;
  const cleanDish = dish.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cleanQuote = quote ? quote.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '随性拍板';
  const titleTpl = getCopy('shared_banner.title_prefix', '来自好友的就餐拍板：【{dish}】').replace('{dish}', cleanDish);
  const unrecorded = getCopy('shared_banner.unrecorded_tag', '未写入本地足迹');
  const descTpl = getCopy('shared_banner.desc_prefix', '好友决策依据：“{quote}”').replace('{quote}', cleanQuote);
  const btnAdopt = getCopy('shared_banner.btn_adopt', '跟着吃同款');
  const btnDismiss = getCopy('shared_banner.btn_dismiss', '我要自己拍板');
  container.innerHTML = `
    <div class="shared-banner">
      <div class="shared-banner-title">
        <span>${titleTpl}</span>
        <span style="font-size: 10px; font-weight: normal; color: var(--ink-muted);">${unrecorded}</span>
      </div>
      <div class="shared-banner-desc">${descTpl}</div>
      <div class="shared-banner-actions">
        <button type="button" class="btn-eat" style="height: 36px; font-size: 12px; flex: 1;" onclick="adoptSharedMeal('${cleanDish}')">${btnAdopt}</button>
        <button type="button" class="btn-revoke" style="height: 36px; font-size: 12px; flex: 1;" onclick="dismissSharedBanner()">${btnDismiss}</button>
      </div>
    </div>
  `;
}

export function adoptSharedMeal(dish) {
  state.currentHistory.push({
    candidate: dish,
    timestamp: new Date().toISOString()
  });
  saveLocalState();
  const toastMsg = getCopy('toasts.shared_adopted', '已将【{dish}】加入今日就餐足迹！').replace('{dish}', dish);
  showToast(toastMsg);
}

export function dismissSharedBanner() {
  const container = document.getElementById('shared-banner-container');
  if (container) container.innerHTML = '';
  document.getElementById('craving-input')?.focus();
}
