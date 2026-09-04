// Shared utilities for review pages

const API_BASE = '/api/reviews';

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  
  return data;
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function getStatusBadge(status) {
  const badges = {
    completed: 'status-completed',
    needs_review: 'status-needs_review',
    partial: 'status-partial',
    pending: 'status-pending',
    processing: 'status-processing',
    failed: 'status-failed',
    rejected: 'status-rejected',
    confirmed: 'status-confirmed',
  };
  const label = status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  return `<span class="status-badge ${badges[status] || ''}">${label}</span>`;
}

export function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function showError(containerId, message) {
  const el = document.getElementById(containerId);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

export function hideError(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.style.display = 'none';
}

export function showLoading(containerId, show = true) {
  const el = document.getElementById(containerId);
  if (el) el.style.display = show ? 'block' : 'none';
}

export function showElement(containerId, show = true) {
  const el = document.getElementById(containerId);
  if (el) el.style.display = show ? 'block' : 'none';
}

export async function populateBusinessFilter(selectId) {
  try {
    const data = await apiFetch('/batches?limit=1&businessId=');
    // We'll need a separate endpoint for businesses, for now just use the batches response
    // Actually, we should call the businesses endpoint
    const bizRes = await fetch('/api/businesses', { credentials: 'include' });
    const bizData = await bizRes.json();
    const select = document.getElementById(selectId);
    if (bizData.businesses) {
      bizData.businesses.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b._id;
        opt.textContent = `${b.name} (${b.pin})`;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.warn('Failed to load businesses for filter:', err);
  }
}

export function buildQueryParams(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else {
        params.set(key, value);
      }
    }
  });
  return params.toString();
}

export function parseMultiSelect(select) {
  return Array.from(select.selectedOptions).map(o => o.value).join(',');
}

export function getFormData(form) {
  const data = new FormData(form);
  const result = {};
  for (const [key, value] of data.entries()) {
    if (result[key]) {
      if (!Array.isArray(result[key])) result[key] = [result[key]];
      result[key].push(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}