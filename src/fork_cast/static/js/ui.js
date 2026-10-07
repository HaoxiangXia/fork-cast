// UI Helpers, Modals, Badges, and DOM Management

import { playClickSound } from './audio.js';
import {
  state,
  getCopy,
  saveLocalState,
  DEFAULT_PRESET_CANDIDATES
} from './storage.js';

export function showToast(msg, duration = 2600) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  if (!toast || !msgEl) return;
  msgEl.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

export function updateClock() {
  const now = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const w = weekdays[now.getDay()];
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const el = document.getElementById('live-clock');
  if (el) el.innerText = `${w} ${h}:${m}`;
}

export function updateQuotaUI() {
  const quotaTag = document.getElementById('quota-tag');
  const keyIndicator = document.getElementById('key-status-indicator');
  if (state.currentApiKey) {
    if (quotaTag) quotaTag.innerText = '个人 Key (无限制)';
    if (keyIndicator) {
      keyIndicator.innerText = '● 个人算力（无限制）';
      keyIndicator.style.color = '#16A34A';
    }
    return;
  }
  if (quotaTag) {
    quotaTag.innerText = `今日免费: ${state.currentQuotaRemaining}/${state.currentQuotaLimit}`;
  }
  if (keyIndicator) {
    if (state.currentQuotaRemaining > 0) {
      keyIndicator.innerText = `● 公共免费额度 (${state.currentQuotaRemaining}/${state.currentQuotaLimit})`;
      keyIndicator.style.color = '#16A34A';
    } else {
      keyIndicator.innerText = '○ 免费额度已用尽 (待填Key)';
      keyIndicator.style.color = '#DC2626';
    }
  }
}

export function updateStatusBadges() {
  const countEl = document.getElementById('status-candidate-count');
  if (countEl) countEl.innerText = state.currentCandidates.length;

  const modalCountEl = document.getElementById('cfg-pool-count');
  if (modalCountEl) modalCountEl.innerText = `共 ${state.currentCandidates.length} 款`;

  updateQuotaUI();

  const recentBox = document.getElementById('recent-meal-tag');
  if (recentBox) {
    const cutoff = new Date(Date.now() - state.currentHistoryHours * 3600 * 1000);
    const recentMeals = state.currentHistory.filter(h => {
      try { return new Date(h.timestamp) >= cutoff; } catch (e) { return true; }
    });

    if (recentMeals.length > 0) {
      const names = recentMeals.slice(-3).reverse().map(h => h.candidate).join('、');
      recentBox.innerText = `${state.currentHistoryHours}H已食: ${names}`;
    } else {
      recentBox.innerText = `${state.currentHistoryHours}H历史: 暂无记录`;
    }
  }
}

export function setHistoryHours(hours) {
  state.currentHistoryHours = parseInt(hours, 10) || 48;
  localStorage.setItem('chilema_history_hours', state.currentHistoryHours);
  updateHistoryHoursUI();
  updateStatusBadges();
  showToast(`已设置防腻回溯窗口为 ${state.currentHistoryHours} 小时`);
}

export function updateHistoryHoursUI() {
  const ind = document.getElementById('history-hours-indicator');
  if (ind) ind.innerText = `${state.currentHistoryHours} 小时`;
  document.querySelectorAll('.history-chip').forEach(chip => {
    const h = parseInt(chip.getAttribute('data-hours'), 10);
    chip.classList.toggle('active', h === state.currentHistoryHours);
  });
}

export function switchModel(model) {
  state.currentModel = model;
  localStorage.setItem('chilema_model', state.currentModel);
  updateModelUI();
  const modelName = state.currentModel.startsWith('d1') ? 'Liquid D1' : 'TypeSafe Jev';
  showToast(`已切换至 ${modelName} 决策内核`);
}

export function updateModelUI() {
  const isD1 = state.currentModel.startsWith('d1');
  const btnJev = document.getElementById('btn-model-jev');
  const btnD1 = document.getElementById('btn-model-d1');
  if (btnJev && btnD1) {
    if (isD1) {
      btnD1.classList.add('model-tab-active');
      btnJev.classList.remove('model-tab-active');
    } else {
      btnJev.classList.add('model-tab-active');
      btnD1.classList.remove('model-tab-active');
    }
  }

  const keyInput = document.getElementById('cfg-api-key');
  if (keyInput) {
    keyInput.placeholder = isD1 ? '输入 Liquid API Key ($LIQUID_API_KEY)' : '输入 TypeSafe API Key (apikey_... 或 vck_...)';
  }

  const presetsBox = document.getElementById('gateway-presets');
  if (presetsBox) {
    if (isD1) {
      presetsBox.innerHTML = `
        <button type="button" class="quick-tag" onclick="setPresetUrl('')" style="flex: 1; text-align: center;">官方直连 (默认)</button>
        <button type="button" class="quick-tag" onclick="setPresetUrl('https://api.liquid.ai/decisions')" style="flex: 1; text-align: center;">Liquid 直连</button>
      `;
    } else {
      presetsBox.innerHTML = `
        <button type="button" class="quick-tag" onclick="setPresetUrl('')" style="flex: 1; text-align: center;">官方直连 (默认)</button>
        <button type="button" class="quick-tag" onclick="setPresetUrl('https://ai-gateway.vercel.sh/typesafe')" style="flex: 1; text-align: center;">Vercel 网关</button>
      `;
    }
  }

  renderFooter(getCopy('brand.footer', '吃什么 · 随性就餐决策 · SYSTEM 1 MODEL'));
}

export function renderFooter(tagline) {
  const text = tagline || getCopy('brand.footer', '吃什么 · 随性就餐决策 · SYSTEM 1 MODEL');
  const taglineEl = document.getElementById('footer-tagline');
  if (taglineEl) {
    taglineEl.textContent = text;
    return;
  }
  const footerEl = document.getElementById('footer-text');
  if (footerEl) {
    footerEl.textContent = text;
  }
}

export function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const apiKeyEl = document.getElementById('cfg-api-key');
  const baseUrlEl = document.getElementById('cfg-base-url');
  if (apiKeyEl) apiKeyEl.value = state.currentApiKey;
  if (baseUrlEl) baseUrlEl.value = state.currentBaseUrl;
  updateModelUI();
  updateHistoryHoursUI();
  renderCandidateChips();
  renderHistoryLogs();
  updateStatusBadges();
}

export function saveSettingsInputs() {
  const apiKeyEl = document.getElementById('cfg-api-key');
  const baseUrlEl = document.getElementById('cfg-base-url');
  if (apiKeyEl) state.currentApiKey = apiKeyEl.value.trim();
  if (baseUrlEl) state.currentBaseUrl = baseUrlEl.value.trim();
  saveLocalState();
}

export function closeSettingsModal() {
  saveSettingsInputs();
  document.getElementById('settings-modal')?.classList.add('hidden');
}

export function saveSettingsAndNotify() {
  saveSettingsInputs();
  showToast('设置与菜单已保存在本机！');
  document.getElementById('settings-modal')?.classList.add('hidden');
}

export function toggleKeyVisibility() {
  const input = document.getElementById('cfg-api-key');
  const btn = document.getElementById('btn-toggle-key');
  if (!input || !btn) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerText = '隐藏';
  } else {
    input.type = 'password';
    btn.innerText = '显示';
  }
}

export function setPresetUrl(url) {
  const input = document.getElementById('cfg-base-url');
  if (input) input.value = url;
  state.currentBaseUrl = url;
  saveLocalState();
  let tip = '已恢复官方直连';
  if (url.includes('vercel')) {
    tip = '已切换至 Vercel 网关';
  } else if (url.includes('liquid')) {
    tip = '已切换至 Liquid 直连网关';
  }
  showToast(tip);
}

export function renderCandidateChips() {
  const container = document.getElementById('candidate-chips');
  if (!container) return;
  container.innerHTML = '';
  state.currentCandidates.forEach(name => {
    const chip = document.createElement('div');
    chip.className = 'candidate-chip';
    chip.innerHTML = `
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</span>
      <button onclick="removeCandidate('${name}')">✕</button>
    `;
    container.appendChild(chip);
  });
  const countEl = document.getElementById('cfg-pool-count');
  if (countEl) countEl.innerText = `共 ${state.currentCandidates.length} 款`;
}

export function addCandidate() {
  const input = document.getElementById('new-candidate-name');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;
  if (state.currentCandidates.includes(name)) {
    showToast('该选项已在候选池中');
    return;
  }
  state.currentCandidates.push(name);
  input.value = '';
  saveLocalState();
  renderCandidateChips();
  updateStatusBadges();
  showToast(`已添加【${name}】`);
}

export function removeCandidate(name) {
  state.currentCandidates = state.currentCandidates.filter(c => c !== name);
  saveLocalState();
  renderCandidateChips();
  updateStatusBadges();
  showToast(`已移除【${name}】`);
}

export function resetPresetCandidates() {
  state.currentCandidates = [...DEFAULT_PRESET_CANDIDATES];
  saveLocalState();
  renderCandidateChips();
  updateStatusBadges();
  showToast('已恢复预设 8 款推荐菜单');
}

export function renderHistoryLogs() {
  const container = document.getElementById('history-log-list');
  if (!container) return;
  container.innerHTML = '';
  if (state.currentHistory.length === 0) {
    container.innerHTML = '<div style="padding: 6px 0; color: #9CA3AF;">暂无用餐记录</div>';
    return;
  }
  state.currentHistory.slice(-8).reverse().forEach(h => {
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.padding = '3px 0';
    item.style.borderBottom = '1px dashed #E5E7EB';
    const tStr = (h.timestamp || '').slice(5, 16).replace('T', ' ');
    item.innerHTML = `
      <span style="font-weight: 600; color: var(--steel-dark);">${h.candidate}</span>
      <span style="font-size: 10px; color: #9CA3AF;">${tStr}</span>
    `;
    container.appendChild(item);
  });
}

export function clearLocalHistory() {
  state.currentHistory = [];
  saveLocalState();
  renderHistoryLogs();
  updateStatusBadges();
  showToast('已清空用餐历史');
}

export function renderExclusions() {
  const box = document.getElementById('exclusions-box');
  const pills = document.getElementById('exclusions-pills');
  if (!box || !pills) return;
  pills.innerHTML = '';
  if (state.currentExclusions.size === 0) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  state.currentExclusions.forEach(item => {
    const p = document.createElement('span');
    p.className = 'excl-tag';
    p.innerHTML = `${item} <button onclick="removeExclusion('${item}')">✕</button>`;
    pills.appendChild(p);
  });
}

export function removeExclusion(item) {
  state.currentExclusions.delete(item);
  renderExclusions();
  showToast(`已恢复【${item}】`);
}

export function checkFirstTimeWelcome() {
  const hasSeen = localStorage.getItem('chilema_welcome_shown');
  if (!hasSeen) {
    const modal = document.getElementById('welcome-modal');
    if (modal) modal.classList.remove('hidden');
  }
}

export function dismissWelcomeModal(goToSettings = false) {
  const modal = document.getElementById('welcome-modal');
  if (modal) modal.classList.add('hidden');
  localStorage.setItem('chilema_welcome_shown', 'true');
  if (goToSettings) {
    openSettingsModal();
  }
}

export function closeWelcomeModal() {
  dismissWelcomeModal(false);
}

export function applyCopy() {
  const copy = state.appCopy;
  if (!copy) return;

  if (copy.brand) {
    if (copy.brand.name) {
      document.title = copy.brand.name;
      const el = document.getElementById('brand-title');
      if (el) el.innerText = copy.brand.name;
    }
    if (copy.brand.subtitle) {
      const el = document.getElementById('brand-subtitle');
      if (el) el.innerHTML = copy.brand.subtitle.replace('：', '：<br/>');
    }
    if (copy.brand.footer) {
      renderFooter(copy.brand.footer);
    }
  }

  if (copy.nav) {
    const bbLabel = document.getElementById('blindbox-nav-label');
    if (bbLabel && copy.nav.blind_box) bbLabel.innerText = copy.nav.blind_box;
    const sLabel = document.getElementById('settings-nav-label');
    if (sLabel && copy.nav.settings) sLabel.innerText = copy.nav.settings;
  }

  if (copy.input) {
    const lTitle = document.getElementById('label-input-title');
    if (lTitle && copy.input.label) lTitle.innerText = copy.input.label;
    const cInput = document.getElementById('craving-input');
    if (cInput && copy.input.placeholder) cInput.placeholder = copy.input.placeholder;
    const qLabel = document.getElementById('label-quick-tags');
    if (qLabel && copy.input.quick_label) qLabel.innerText = copy.input.quick_label;
    const sBtnText = document.getElementById('btn-decide-text');
    if (sBtnText && copy.input.slap_button) sBtnText.innerText = copy.input.slap_button;
    const sSlot = document.getElementById('label-dispenser-slot');
    if (sSlot && copy.input.dispenser_slot) sSlot.innerText = copy.input.dispenser_slot;
    const ePrefix = document.getElementById('label-excl-prefix');
    if (ePrefix && copy.input.exclusion_prefix) ePrefix.innerText = copy.input.exclusion_prefix;

    if (Array.isArray(copy.input.quick_tags) && copy.input.quick_tags.length > 0) {
      const container = document.getElementById('quick-tags-container');
      if (container) {
        container.innerHTML = '';
        copy.input.quick_tags.forEach(t => {
          const btn = document.createElement('button');
          btn.className = 'quick-tag';
          btn.setAttribute('data-text', t.text);
          btn.innerText = t.label;
          btn.addEventListener('click', () => {
            const input = document.getElementById('craving-input');
            if (input) input.value = t.text;
            playClickSound();
          });
          container.appendChild(btn);
        });
      }
    }
  }

  if (copy.modals) {
    if (copy.modals.settings) {
      const s = copy.modals.settings;
      const sTitle = document.getElementById('settings-modal-title') || document.querySelector('#settings-modal .modal-head span');
      if (sTitle && s.title) sTitle.innerText = s.title;
      const sSave = document.getElementById('btn-save-settings');
      if (sSave && s.btn_save) sSave.innerText = s.btn_save;
    }
    if (copy.modals.welcome) {
      const w = copy.modals.welcome;
      const wTitle = document.querySelector('#welcome-modal .modal-head span');
      if (wTitle && w.title) wTitle.innerText = w.title;
      const wDesc = document.querySelector('#welcome-modal .modal-content > p');
      if (wDesc && w.desc) wDesc.innerText = w.desc;
      const btnDismiss = document.querySelector('#welcome-modal .btn-eat');
      if (btnDismiss && w.btn_dismiss) btnDismiss.innerText = w.btn_dismiss;
      const btnSettings = document.querySelector('#welcome-modal .btn-revoke');
      if (btnSettings && w.btn_settings) btnSettings.innerText = w.btn_settings;
    }
    if (copy.modals.blind_box) {
      const b = copy.modals.blind_box;
      const bTitle = document.querySelector('#blindbox-modal .modal-head span');
      if (bTitle && b.title) bTitle.innerText = b.title;
      const bRoll = document.getElementById('btn-roll-blindbox');
      if (bRoll && b.btn_roll) bRoll.innerText = b.btn_roll;
      const bAccept = document.getElementById('btn-accept-blindbox');
      if (bAccept && b.btn_accept) bAccept.innerText = b.btn_accept;
    }
    if (copy.modals.duel) {
      const d = copy.modals.duel;
      const dTitle = document.querySelector('#duel-modal .modal-head span');
      if (dTitle && d.title) dTitle.innerText = d.title;
      const dSpin = document.getElementById('btn-spin-duel');
      if (dSpin && d.btn_spin) dSpin.innerText = d.btn_spin;
      const dAccept = document.getElementById('btn-accept-duel');
      if (dAccept && d.btn_accept) dAccept.innerText = d.btn_accept;
    }
  }
}
