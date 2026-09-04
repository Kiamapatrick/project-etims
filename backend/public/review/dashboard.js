// Review Dashboard Logic

import { apiFetch, formatDate, formatCurrency, getStatusBadge, populateBusinessFilter, buildQueryParams, parseMultiSelect, showError, hideError, showLoading, showElement } from './review.js';

function getQbStatusBadge(status) {
  const badges = {
    connected: 'status-completed',
    not_configured: 'status-pending',
    expired: 'status-failed',
    error: 'status-failed',
    disconnected: 'status-rejected',
  };
  const label = status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  return `<span class="status-badge ${badges[status] || ''}">${label}</span>`;
}

const state = {
  page: 1,
  limit: 20,
  totalPages: 1,
  total: 0,
};

document.addEventListener('DOMContentLoaded', async () => {
  await populateBusinessFilter('businessFilter');
  loadUserInfo();
  loadBatches();
  
  document.getElementById('filterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.page = 1;
    loadBatches();
  });
  
  document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('filterForm').reset();
    document.getElementById('statusFilter').selectedOptions[0].selected = true;
    document.getElementById('statusFilter').selectedOptions[1].selected = true;
    document.getElementById('statusFilter').selectedOptions[2].selected = true;
    state.page = 1;
    loadBatches();
  });
  
  document.getElementById('prevPage').addEventListener('click', () => {
    if (state.page > 1) {
      state.page--;
      loadBatches();
    }
  });
  
  document.getElementById('nextPage').addEventListener('click', () => {
    if (state.page < state.totalPages) {
      state.page++;
      loadBatches();
    }
  });
  
  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  });
});

async function loadUserInfo() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (data.user) {
      document.getElementById('userInfo').textContent = `${data.user.email} (${data.user.role})`;
    }
  } catch (err) {
    console.warn('Failed to load user info');
  }
}

async function loadBatches() {
  showLoading('loading', true);
  hideError('error');
  showElement('tableContainer', false);
  
  try {
    const filters = {
      businessId: document.getElementById('businessFilter').value || undefined,
      status: parseMultiSelect(document.getElementById('statusFilter')),
      dateFrom: document.getElementById('dateFrom').value || undefined,
      dateTo: document.getElementById('dateTo').value || undefined,
      page: state.page,
      limit: state.limit,
    };
    
    const query = buildQueryParams(filters);
    const data = await apiFetch(`/batches?${query}`);
    
    state.total = data.pagination.total;
    state.totalPages = data.pagination.totalPages;
    state.page = data.pagination.page;
    
    // Fetch QB status for batches that have businessId
    await enrichBatchesWithQbStatus(data.batches);
    
    renderBatches(data.batches);
    updatePagination();
    showElement('tableContainer', true);
  } catch (err) {
    showError('error', err.message);
  } finally {
    showLoading('loading', false);
  }
}

async function enrichBatchesWithQbStatus(batches) {
  // Group batches by businessId to minimize QB status calls
  const businessIds = [...new Set(batches.map(b => b.business?._id).filter(Boolean))];
  const qbStatusMap = new Map();
  
  for (const businessId of businessIds) {
    try {
      const status = await apiFetch(`/quickbooks/status/${businessId}`);
      qbStatusMap.set(businessId, status);
    } catch (err) {
      qbStatusMap.set(businessId, { connected: false, status: 'error' });
    }
  }
  
  batches.forEach(batch => {
    if (batch.business?._id) {
      batch.qbStatus = qbStatusMap.get(batch.business._id) || { connected: false, status: 'not_configured' };
    } else {
      batch.qbStatus = { connected: false, status: 'not_configured' };
    }
  });
}

function renderBatches(batches) {
  const tbody = document.getElementById('batchesTableBody');
  tbody.innerHTML = '';
  
  batches.forEach(batch => {
    const tr = document.createElement('tr');
    tr.className = 'clickable';
    tr.addEventListener('click', () => {
      window.location.href = `/review/batch.html?batchId=${batch.batchId}`;
    });
    
    const qbStatusHtml = batch.qbStatus ? getQbStatusBadge(batch.qbStatus.status) : '';
    
    tr.innerHTML = `
      <td><code>${batch.batchId.slice(0, 8)}...</code></td>
      <td>${batch.business?.name || 'Unknown'} <small>(${batch.business?.pin || ''})</small></td>
      <td>${formatDate(batch.createdAt)}</td>
      <td>${batch.totalFiles}</td>
      <td>${batch.extractedCount}</td>
      <td>${batch.needsReviewCount}</td>
      <td>${batch.rejectedCount}</td>
      <td>${batch.failedCount}</td>
      <td>${getStatusBadge(batch.status)}</td>
      <td>${qbStatusHtml}</td>
      <td>
        <a href="/review/batch.html?batchId=${batch.batchId}" class="btn btn-secondary btn-sm">Review</a>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
if (batches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 2rem; color: var(--text-muted);">No batches found</td></tr>';
  }
}

function updatePagination() {
  document.getElementById('pageInfo').textContent = `Page ${state.page} of ${state.totalPages || 1}`;
  document.getElementById('prevPage').disabled = state.page <= 1;
  document.getElementById('nextPage').disabled = state.page >= state.totalPages;
}