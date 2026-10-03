// LocalStorage & State Management

export const DEFAULT_PRESET_CANDIDATES = [
  "牛肉拉面", "麦当劳", "麻辣烫", "猪脚饭",
  "轻食沙拉", "关东煮", "黄焖鸡", "重庆小面"
];

export const state = {
  appCopy: null,
  currentApiKey: '',
  currentBaseUrl: '',
  currentModel: 'jev-latest',
  currentHistoryHours: 48,
  currentCandidates: [],
  currentHistory: [],
  currentExclusions: new Set(),
  currentQuotaRemaining: 10,
  currentQuotaLimit: 10,
  lastDecisionResult: null,
  duelContenders: [],
  duelWinner: null,
  lastBlindBoxDish: ''
};

export function getCopy(path, fallback = '') {
  if (!state.appCopy) return fallback;
  const parts = path.split('.');
  let cur = state.appCopy;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = cur[p];
    } else {
      return fallback;
    }
  }
  return typeof cur === 'string' ? cur : fallback;
}

export function getOrCreateDeviceId() {
  let devId = localStorage.getItem('chilema_device_id');
  if (!devId) {
    devId = 'dev_' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem('chilema_device_id', devId);
  }
  return devId;
}

export function loadLocalState() {
  state.currentApiKey = (localStorage.getItem('chilema_api_key') || '').trim();
  state.currentBaseUrl = (localStorage.getItem('chilema_base_url') || '').trim();
  state.currentModel = (localStorage.getItem('chilema_model') || 'jev-latest').trim();
  state.currentHistoryHours = parseInt(localStorage.getItem('chilema_history_hours') || '48', 10);

  const rawCandidates = localStorage.getItem('chilema_candidates');
  if (rawCandidates) {
    try {
      const parsed = JSON.parse(rawCandidates);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.currentCandidates = parsed;
      } else {
        state.currentCandidates = [...DEFAULT_PRESET_CANDIDATES];
      }
    } catch (e) {
      state.currentCandidates = [...DEFAULT_PRESET_CANDIDATES];
    }
  } else {
    state.currentCandidates = [...DEFAULT_PRESET_CANDIDATES];
    localStorage.setItem('chilema_candidates', JSON.stringify(state.currentCandidates));
  }

  const rawHist = localStorage.getItem('chilema_history');
  if (rawHist) {
    try {
      const parsed = JSON.parse(rawHist);
      state.currentHistory = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      state.currentHistory = [];
    }
  } else {
    state.currentHistory = [];
  }
}

export function saveLocalState() {
  localStorage.setItem('chilema_api_key', state.currentApiKey);
  localStorage.setItem('chilema_base_url', state.currentBaseUrl);
  localStorage.setItem('chilema_model', state.currentModel);
  localStorage.setItem('chilema_history_hours', state.currentHistoryHours);
  localStorage.setItem('chilema_candidates', JSON.stringify(state.currentCandidates));
  localStorage.setItem('chilema_history', JSON.stringify(state.currentHistory));
}

export function getRecentHistoryForApi(hours = state.currentHistoryHours) {
  const cutoff = new Date(Date.now() - hours * 3600 * 1000);
  return state.currentHistory.filter(h => {
    try { return new Date(h.timestamp) >= cutoff; } catch (e) { return true; }
  });
}

export function exportBackupData() {
  const data = {
    api_key: state.currentApiKey,
    base_url: state.currentBaseUrl,
    candidates: state.currentCandidates,
    history: state.currentHistory,
    exported_at: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chilema_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackupData(file, onSuccess, onError) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.api_key !== undefined) state.currentApiKey = String(data.api_key);
      if (typeof data.base_url === 'string') state.currentBaseUrl = data.base_url;
      if (Array.isArray(data.candidates) && data.candidates.length > 0) state.currentCandidates = data.candidates;
      if (Array.isArray(data.history)) state.currentHistory = data.history;

      saveLocalState();
      if (onSuccess) onSuccess();
    } catch (err) {
      if (onError) onError(err);
    }
  };
  reader.readAsText(file);
}
