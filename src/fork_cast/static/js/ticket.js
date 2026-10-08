// Ticket Dispenser Component (Thermal Receipt Metaphor)

import { playClickSound, playStampSound } from './audio.js';
import { state, getCopy, saveLocalState } from './storage.js';
import { createQRCodeSVG, createQRCodeMatrix } from './qrcode.js';
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
          <span>${getCopy('ticket.labels.confidence', 'System 1 校准置信度')}</span>
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

export async function saveShareImage() {
  if (!lastDecisionData) return;
  const data = lastDecisionData;
  const dish = data.primary || '就餐决策';
  const msg = data.message || '';
  const verdict = data.verdict || 'decisive_pick';
  const conf = data.confidence !== undefined ? data.confidence : 0.95;
  const alts = Array.isArray(data.alternatives) ? data.alternatives : [];
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const serialNo = `FC-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(1000 + Math.random()*9000)}`;
  const shareUrl = `${window.location.origin}${window.location.pathname}?share=1&dish=${encodeURIComponent(dish)}`;

  const stampMap = {
    decisive_pick: { text: getCopy('ticket.stamps.decisive', '拍板落定'), color: '#D73318' },
    soft_pick: { text: getCopy('ticket.stamps.soft', '倾向建议'), color: '#C27911' },
    impasse: { text: getCopy('ticket.stamps.impasse', '神仙难救'), color: '#1F2937' },
    indifference: { text: getCopy('ticket.stamps.indifference', '盲盒邀约'), color: '#C27911' },
    dilemma_duel: { text: '势均力敌', color: '#B45309' }
  };
  const stamp = stampMap[verdict] || { text: '拍板落定', color: '#D73318' };

  // Load logo icon
  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  logoImg.src = '/static/apple-touch-icon.png';
  await new Promise(r => {
    logoImg.onload = r;
    logoImg.onerror = r;
    setTimeout(r, 250);
  });
  const userCraving = document.getElementById('craving-input')?.value?.trim() || data.craving || '';
  const displayCraving = userCraving ? `“${userCraving.length > 22 ? userCraving.slice(0, 22) + '...' : userCraving}”` : '“随性就餐，直接拍板”';

  // Measure distribution
  const probs = data.probabilities && Object.keys(data.probabilities).length > 0 ? data.probabilities : null;
  let topPairsStr = '';
  if (probs) {
    topPairsStr = Object.entries(probs)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k,v]) => `${k}: ${(v*100).toFixed(0)}%`)
      .join('  |  ');
  }

  // Pre-calculate exact vertical coordinates to eliminate dead whitespace
  const w = 440;
  const cardX = 24;
  const cardW = w - 48;
  const toothW = 15;
  const toothH = 9;

  const cravingBoxY = 74;
  const cravingH = 46;
  const cravingBottom = cravingBoxY + cravingH + 20;

  // Shift slit section down with comfortable 18px margin
  const labelY = cravingBottom + 18;
  const slitY = labelY + 11;
  const cardY = slitY + 8 + 16; // 16px gap below slit

  const headerTimeY = cardY + 44;
  const dishY = cardY + 98;
  const altsH = alts.length > 0 ? 22 : 0;
  const quoteY = dishY + 16 + altsH;
  const quoteH = 42;
  const confY = quoteY + quoteH + 12;
  const confBoxH = topPairsStr ? 46 : 28;
  const divY = confY + confBoxH + 14;
  const qrBoxY = divY + 14;
  const qrX = cardX + 20;
  const qrSize = 88;
  const noticeY = qrBoxY + qrSize + 22;

  // The bottom of the ticket is exactly 18px below the notice! Zero dead whitespace!
  const cardH = (noticeY - cardY) + 18;
  const h = cardY + cardH + toothH + 28;

  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Background tile
  ctx.fillStyle = '#D1DCD6';
  ctx.fillRect(0, 0, w, h);

  // 1. TOP MACHINE HEADER
  ctx.fillStyle = '#243028';
  ctx.fillRect(0, 0, w, 56);
  ctx.fillStyle = '#1E2721';
  ctx.fillRect(0, 54, w, 2);

  if (logoImg.complete && logoImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(36, 28, 14, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, 22, 14, 28, 28);
    ctx.restore();
  }

  // Title "吃什么"
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(getCopy('brand.name', '吃什么'), 60, 34);

  // Subtitle (No repeated "吃什么")
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#9CA3AF';
  ctx.fillText(getCopy('brand.poster_subtitle', '随性就餐决策 · SYSTEM 1 MODEL'), 125, 33);

  // 2. CRAVING INPUT ZONE (诉求投币口)
  ctx.fillStyle = '#1A241E';
  ctx.font = '800 11.5px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(getCopy('input.label', '诉求投币口'), 24, cravingBoxY + 13);

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(24, cravingBoxY + 20, cardW, cravingH, 6);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#1E2721';
  ctx.stroke();

  ctx.fillStyle = '#141A16';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(displayCraving, 36, cravingBoxY + 48);

  // 3. DISPENSER SLIT (出票导槽: 充足间距，绝不压边)
  ctx.textAlign = 'center';
  ctx.font = '800 9.5px sans-serif';
  ctx.fillStyle = '#59675F';
  ctx.fillText(getCopy('input.dispenser_slot', '▼ 出票导槽 ▼'), w / 2, labelY);

  ctx.fillStyle = '#1E2721';
  ctx.beginPath();
  ctx.roundRect(36, slitY, w - 72, 8, 4);
  ctx.fill();

  // 4. THERMAL RECEIPT TICKET (Dynamic tight card!)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.roundRect(cardX + 4, cardY + 6, cardW, cardH, [6, 6, 0, 0]);
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(cardX, cardY + 6);
  ctx.arcTo(cardX, cardY, cardX + 6, cardY, 6);
  ctx.lineTo(cardX + cardW - 6, cardY);
  ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + 6, 6);
  ctx.lineTo(cardX + cardW, cardY + cardH);

  const teeth = Math.round(cardW / toothW);
  for (let i = teeth; i > 0; i--) {
    const rx = cardX + (i - 0.5) * toothW;
    const lx = cardX + (i - 1) * toothW;
    ctx.lineTo(rx, cardY + cardH + toothH);
    ctx.lineTo(lx, cardY + cardH);
  }
  ctx.lineTo(cardX, cardY + 6);
  ctx.closePath();

  // Pure White Ticket Fill!
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1E2721';
  ctx.stroke();

  // Stamp Seal
  ctx.save();
  ctx.translate(cardX + cardW - 55, cardY + 36);
  ctx.rotate(-7 * Math.PI / 180);
  ctx.strokeStyle = stamp.color;
  ctx.lineWidth = 2.2;
  ctx.strokeRect(-42, -14, 84, 28);
  ctx.fillStyle = stamp.color;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stamp.text, 0, 0);
  ctx.restore();

  // Header & Time
  ctx.fillStyle = '#6B7280';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(getCopy('ticket.header_brand', '吃什么 · 专属餐券'), cardX + cardW / 2, cardY + 28);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#59675F';
  ctx.fillText(timeStr, cardX + cardW / 2, headerTimeY);

  // Dashed line
  ctx.strokeStyle = '#D1D5DB';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cardX + 16, cardY + 56);
  ctx.lineTo(cardX + cardW - 16, cardY + 56);
  ctx.stroke();
  ctx.setLineDash([]);

  // Dish Title
  ctx.fillStyle = '#141A16';
  ctx.font = '900 28px sans-serif';
  ctx.fillText(dish, cardX + cardW / 2, dishY);

  // Alternatives
  if (alts.length > 0) {
    ctx.fillStyle = '#59675F';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${getCopy('ticket.labels.alternatives_prefix', '备选:')} ${alts.join('、')}`, cardX + cardW / 2, cardY + 120);
  }

  // Quote Box
  ctx.fillStyle = '#F9FAFB';
  ctx.fillRect(cardX + 16, quoteY, cardW - 32, quoteH);
  ctx.fillStyle = '#374151';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  const displayMsg = msg.length > 24 ? msg.slice(0, 24) + '...' : msg;
  ctx.fillText(`“${displayMsg}”`, cardX + cardW / 2, quoteY + 25);

  // Confidence Box
  ctx.fillStyle = '#F3F4F6';
  ctx.fillRect(cardX + 16, confY, cardW - 32, confBoxH);
  ctx.strokeStyle = '#D1D5DB';
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(cardX + 16, confY, cardW - 32, confBoxH);
  ctx.setLineDash([]);

  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#1A241E';
  ctx.textAlign = 'left';
  const confLabel = getCopy('ticket.labels.confidence', 'System 1 校准置信度');
  ctx.fillText(confLabel, cardX + 26, confY + 18);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(conf * 100)}%`, cardX + cardW - 26, confY + 18);

  ctx.textAlign = 'left';
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#59675F';
  const distPrefix = getCopy('ticket.labels.distribution', '候选分布:');
  ctx.fillText(`${distPrefix} ${topPairsStr || '置信决策'}`, cardX + 26, confY + 36);

  // Divider
  ctx.strokeStyle = '#D1D5DB';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cardX + 16, divY);
  ctx.lineTo(cardX + cardW - 16, divY);
  ctx.stroke();
  ctx.setLineDash([]);

  // QR Code & Meta Section (Crisp 88px QR)

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(qrX, qrBoxY, qrSize, qrSize);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#1E2721';
  ctx.strokeRect(qrX, qrBoxY, qrSize, qrSize);

  try {
    const matrix = createQRCodeMatrix(shareUrl);
    const mLen = matrix.length;
    const qrCanvas = document.createElement('canvas');
    qrCanvas.width = mLen;
    qrCanvas.height = mLen;
    const qrCtx = qrCanvas.getContext('2d');
    const imgData = qrCtx.createImageData(mLen, mLen);
    for (let r = 0; r < mLen; r++) {
      for (let c = 0; c < mLen; c++) {
        const idx = (r * mLen + c) * 4;
        const dark = matrix[r][c];
        imgData.data[idx] = dark ? 20 : 255;
        imgData.data[idx + 1] = dark ? 26 : 255;
        imgData.data[idx + 2] = dark ? 22 : 255;
        imgData.data[idx + 3] = 255;
      }
    }
    qrCtx.putImageData(imgData, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrCanvas, qrX + 4, qrBoxY + 4, qrSize - 8, qrSize - 8);
    ctx.restore();
  } catch (qrErr) {
    console.warn('Canvas QR render fallback:', qrErr);
  }

  // Meta Text
  const metaX = qrX + qrSize + 14;
  ctx.textAlign = 'left';
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#1A241E';
  ctx.fillText(`${getCopy('ticket.labels.serial_prefix', 'NO. ')}${serialNo}`, metaX, qrBoxY + 18);

  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#1A241E';
  ctx.fillText(getCopy('ticket.labels.qr_title', '扫码核验 · 查看同款决策'), metaX, qrBoxY + 38);

  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#59675F';
  ctx.fillText(getCopy('ticket.labels.qr_sub', '吃什么 · 随性就餐决策机'), metaX, qrBoxY + 54);

  ctx.font = 'bold 8.5px monospace';
  ctx.fillStyle = '#C27911';
  ctx.fillText(getCopy('ticket.labels.qr_tag', 'SYSTEM 1 MODEL PROBABILISTIC PICK'), metaX, qrBoxY + 70);

  // Notice
  ctx.textAlign = 'center';
  ctx.font = '9.5px sans-serif';
  ctx.fillStyle = '#59675F';
  ctx.fillText(getCopy('ticket.labels.notice', '※ 凭此券准时就餐 · 建议趁热享用 ※'), cardX + cardW / 2, noticeY);

  const a = document.createElement('a');
  a.download = `fork-cast-${dish}.png`;
  a.href = canvas.toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(getCopy('toasts.image_downloaded', '餐券图片已下载！'));
}

export function renderSharedBanner(dish, quote) {
  const container = document.getElementById('shared-banner-container');
  if (!container) return;
  const cleanDish = dish.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cleanQuote = quote ? quote.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '随性拍板';
  const titleTpl = getCopy('shared_banner.title_prefix', '来自好友的就餐拍板：【{dish}】').replace('{dish}', cleanDish);
  const descTpl = getCopy('shared_banner.desc_prefix', '好友决策依据：“{quote}”').replace('{quote}', cleanQuote);
  const btnAdopt = getCopy('shared_banner.btn_adopt', '跟着吃同款');
  const btnDismiss = getCopy('shared_banner.btn_dismiss', '我要自己拍板');
  container.innerHTML = `
    <div class="shared-banner">
      <div class="shared-banner-title">
        <span>${titleTpl}</span>
      </div>
      <div class="shared-banner-desc">${descTpl}</div>
      <div class="shared-banner-actions">
        <button type="button" class="btn-eat" style="height: 36px; font-size: 12px; flex: 1; min-width: 0;" onclick="adoptSharedMeal('${cleanDish}')">${btnAdopt}</button>
        <button type="button" class="btn-share-ticket" style="height: 36px; font-size: 12px; flex: 1; min-width: 0;" onclick="dismissSharedBanner()">${btnDismiss}</button>
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
