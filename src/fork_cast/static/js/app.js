// Main Application Entry Point (ESM Architecture)

import { playClickSound, playStampSound } from './audio.js';
import { fetchCopyApi, fetchQuotaApi, postDecisionApi } from './api.js';
import {
  state,
  getCopy,
  loadLocalState,
  saveLocalState,
  getOrCreateDeviceId,
  getRecentHistoryForApi,
  exportBackupData,
  importBackupData
} from './storage.js';
import {
  openDuelModal,
  closeDuelModal,
  drawWheel,
  spinWheel,
  initDuel,
  setDuelAcceptCallback
} from './duel.js';
import {
  openBlindBoxModal,
  closeBlindBoxModal,
  rollBlindBox,
  initBlindBox,
  setBlindBoxCallbacks
} from './blindbox.js';
import {
  renderTicket,
  acceptMeal,
  revokeDecision,
  refocusInput,
  openShareModal,
  closeShareModal,
  copyShareLink,
  saveShareImage,
  renderSharedBanner,
  adoptSharedMeal,
  dismissSharedBanner
} from './ticket.js';
import {
  showToast,
  updateClock,
  updateQuotaUI,
  updateStatusBadges,
  setHistoryHours,
  updateHistoryHoursUI,
  switchModel,
  updateModelUI,
  openSettingsModal,
  closeSettingsModal,
  saveSettingsInputs,
  saveSettingsAndNotify,
  toggleKeyVisibility,
  setPresetUrl,
  renderCandidateChips,
  addCandidate,
  removeCandidate,
  resetPresetCandidates,
  renderHistoryLogs,
  clearLocalHistory,
  renderExclusions,
  removeExclusion,
  checkFirstTimeWelcome,
  dismissWelcomeModal,
  closeWelcomeModal,
  applyCopy
} from './ui.js';

// Expose handlers to window to ensure 100% compatibility with inline attributes & dynamic HTML
window.switchModel = switchModel;
window.setHistoryHours = setHistoryHours;
window.setPresetUrl = setPresetUrl;
window.removeCandidate = removeCandidate;
window.removeExclusion = removeExclusion;
window.acceptMeal = acceptMeal;
window.revokeDecision = revokeDecision;
window.refocusInput = refocusInput;
window.renderTicket = renderTicket;
window.openBlindBoxModal = openBlindBoxModal;
window.openDuelModal = openDuelModal;
window.closeWelcomeModal = closeWelcomeModal;
window.dismissWelcomeModal = dismissWelcomeModal;
window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;
window.copyShareLink = copyShareLink;
window.saveShareImage = saveShareImage;
window.adoptSharedMeal = adoptSharedMeal;
window.dismissSharedBanner = dismissSharedBanner;
// DECIDE FLOW
async function submitDecision() {
  const cravingInput = document.getElementById('craving-input');
  const craving = (cravingInput?.value || '').trim();
  if (!craving) {
    showToast('请先输入几句就餐想法');
    return;
  }

  // If user has no personal key and quota is known to be 0
  if (!state.currentApiKey && state.currentQuotaRemaining <= 0) {
    showToast('今日 10 次免费额度已用尽，请在设置中配置个人 API Key！');
    openSettingsModal();
    return;
  }

  if (state.currentCandidates.length === 0) {
    showToast('候选池为空，请先在设置中添加几款常吃菜品');
    openSettingsModal();
    return;
  }

  playClickSound();
  const btn = document.getElementById('btn-decide');
  const btnText = document.getElementById('btn-decide-text');
  if (btn) btn.disabled = true;
  const loadingText = getCopy('input.slap_loading', '正在调动 System 1 决策模型...');
  const devId = getOrCreateDeviceId();

  let data;
  try {
    const res = await postDecisionApi({
      craving: craving,
      exclusions: Array.from(state.currentExclusions),
      candidates: state.currentCandidates,
      recent_history: getRecentHistoryForApi(state.currentHistoryHours),
      history_window_hours: state.currentHistoryHours,
      api_key: state.currentApiKey || null,
      base_url: state.currentBaseUrl || null,
      model: state.currentModel,
    }, devId);

    if (res.status === 429) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = typeof errData.detail === 'string'
        ? errData.detail
        : (errData.detail && errData.detail.message) || '今日 10 次免费额度已用尽，请在设置中配置个人 API Key！';
      state.currentQuotaRemaining = 0;
      updateQuotaUI();
      showToast(errMsg);
      openSettingsModal();
      if (btn) btn.disabled = false;
      if (btnText) btnText.innerText = '拍 板 决 策';
      return;
    }

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    data = await res.json();
  } catch (err) {
    if (btn) btn.disabled = false;
    if (btnText) btnText.innerText = '拍 板 决 策';
    showToast('请求失败，请检查网络与设置');
    return;
  }

  if (data.quota_remaining !== undefined && data.quota_remaining !== null) {
    state.currentQuotaRemaining = data.quota_remaining;
    if (data.quota_limit) state.currentQuotaLimit = data.quota_limit;
    updateQuotaUI();
  }
  state.lastDecisionResult = data;
  if (btn) btn.disabled = false;
  if (btnText) btnText.innerText = '拍 板 决 策';

  try {
    if (data.verdict === 'dilemma_duel') {
      state.duelContenders = data.alternatives && data.alternatives.length >= 2 ? data.alternatives : [data.primary];
      state.duelWinner = data.primary;
      openDuelModal();
    } else {
      renderTicket(data);
    }
  } catch (renderErr) {
    console.error('Ticket rendering error:', renderErr);
    showToast('餐券生成异常，请重试');
  }
}

async function fetchQuotaStatus() {
  if (state.currentApiKey) {
    updateQuotaUI();
    return;
  }
  try {
    const devId = getOrCreateDeviceId();
    const q = await fetchQuotaApi(devId);
    state.currentQuotaRemaining = q.remaining;
    state.currentQuotaLimit = q.limit;
    updateQuotaUI();
  } catch (e) {}
}

async function initCopy() {
  try {
    state.appCopy = await fetchCopyApi();
    applyCopy();
  } catch (e) {
    console.warn('Using default copy:', e);
  }
}

// SETUP LISTENERS
function initEventListeners() {
  initDuel();
  setDuelAcceptCallback(() => renderTicket(state.lastDecisionResult));

  initBlindBox();
  setBlindBoxCallbacks({
    onAccept: acceptMeal,
    showToast
  });

  // Settings drawer listeners
  document.getElementById('btn-open-settings')?.addEventListener('click', openSettingsModal);
  document.getElementById('btn-close-settings')?.addEventListener('click', closeSettingsModal);
  document.getElementById('btn-save-settings')?.addEventListener('click', saveSettingsAndNotify);
  document.getElementById('btn-toggle-key')?.addEventListener('click', toggleKeyVisibility);
  document.getElementById('btn-toggle-custom-url')?.addEventListener('click', () => {
    const box = document.getElementById('custom-url-box');
    box?.classList.toggle('hidden');
  });
  document.getElementById('btn-add-candidate')?.addEventListener('click', addCandidate);
  document.getElementById('new-candidate-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCandidate();
  });
  document.getElementById('btn-reset-preset-candidates')?.addEventListener('click', resetPresetCandidates);
  document.getElementById('btn-clear-history')?.addEventListener('click', clearLocalHistory);
  document.getElementById('btn-export-data')?.addEventListener('click', exportBackupData);
  document.getElementById('input-import-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      importBackupData(file, () => {
        openSettingsModal();
        showToast('配置备份已成功恢复！');
      }, () => {
        showToast('导入失败，请检查 JSON 格式');
      });
      e.target.value = '';
    }
  });

  // Decide button & hotkey
  document.getElementById('btn-decide')?.addEventListener('click', submitDecision);
  document.getElementById('craving-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      submitDecision();
    }
  });
}

// BOOTSTRAP
function init() {
  loadLocalState();
  initEventListeners();
  updateModelUI();
  initCopy();
  fetchQuotaStatus();
  checkFirstTimeWelcome();

  // Check friend share URL params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('share') === '1' && urlParams.get('dish')) {
    const sharedDish = urlParams.get('dish');
    const sharedQuote = urlParams.get('quote') || '';
    renderSharedBanner(sharedDish, sharedQuote);
    renderTicket({
      verdict: 'decisive_pick',
      primary: sharedDish,
      alternatives: [],
      message: sharedQuote || '好友向你投递了一张就餐决策券，建议一同享用！',
      probabilities: { [sharedDish]: 0.94 },
      confidence: 0.94,
      auto_logged: false,
      model: 'jev-latest'
    });
  }
  setInterval(updateClock, 1000);
  updateClock();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
