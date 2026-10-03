// API Communication Client

export async function fetchCopyApi() {
  const res = await fetch('/api/copy');
  if (!res.ok) {
    throw new Error(`Failed to fetch copy: ${res.status}`);
  }
  return res.json();
}

export async function fetchQuotaApi(deviceId) {
  const res = await fetch(`/api/quota?device_id=${encodeURIComponent(deviceId)}`, {
    headers: { 'X-Device-Id': deviceId }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch quota: ${res.status}`);
  }
  return res.json();
}

export async function postDecisionApi(payload, deviceId) {
  const res = await fetch('/api/decide', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId
    },
    body: JSON.stringify(payload)
  });
  return res;
}
