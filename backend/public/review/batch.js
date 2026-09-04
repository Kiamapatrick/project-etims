// Batch Grid Logic

import { apiFetch, formatDate, formatCurrency, getStatusBadge, getUrlParam, showError, hideError, showLoading, showElement } from './review.js';

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

const batchId = getUrlParam('batchId');
let currentBatch = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!batchId) {
    showError('error', 'No batch ID provided');
    return;
  }
  
  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  });
  
  document.getElementById('bulkConfirmBtn').addEventListener('click', handleBulkConfirm);
  document.getElementById('syncAllQbBtn').addEventListener('click', handleSyncAllQuickBooks);
  document.getElementById('exportCsvBtn').addEventListener('click', handleExportCsv);
  
  await loadBatch();
});

async function loadBatch() {
  showLoading('loading', true);
  hideError('error');
  
  try {
    const data = await apiFetch(`/batch/${batchId}`);
    currentBatch = data.batch;
    renderBatch(data.batch);
    showElement('batchGrid', true);
    
    // Load QB status for batch actions
    if (currentBatch.business?._id) {
      await loadQbStatus(currentBatch.business._id);
    }
  } catch (err) {
    showError('error', err.message);
  } finally {
    showLoading('loading', false);
  }
}

function renderBatch(batch) {
  document.getElementById('batchTitle').textContent = `Batch: ${batch.batchId.slice(0, 8)}...`;
  document.getElementById('batchStatus').innerHTML = getStatusBadge(batch.status);
  document.getElementById('batchBusiness').textContent = `${batch.business?.name || 'Unknown'} (${batch.business?.pin || ''})`;
  document.getElementById('batchDate').textContent = `Created: ${formatDate(batch.createdAt)}`;
  
  document.getElementById('statTotal').textContent = batch.totalFiles;
  document.getElementById('statExtracted').textContent = batch.files.filter(f => f.status === 'extracted').length;
  document.getElementById('statReview').textContent = batch.files.filter(f => f.status === 'needs_review').length;
  document.getElementById('statRejected').textContent = batch.files.filter(f => f.status === 'rejected').length;
  document.getElementById('statFailed').textContent = batch.files.filter(f => f.status === 'failed').length;
  
  // Show bulk confirm button if there are extracted files with high confidence
  const hasHighConfidence = batch.files.some(f => 
    f.status === 'extracted' && f.confidenceScore >= 0.85
  );
  document.getElementById('bulkConfirmBtn').style.display = hasHighConfidence ? 'inline-flex' : 'none';
  
  // Show sync/export buttons if there are confirmed sales
  const confirmedCount = batch.files.filter(f => f.status === 'confirmed' && f.linkedSaleId).length;
  document.getElementById('syncAllQbBtn').style.display = confirmedCount > 0 ? 'inline-flex' : 'none';
  document.getElementById('exportCsvBtn').style.display = confirmedCount > 0 ? 'inline-flex' : 'none';
  
  renderFiles(batch.files);
}

function renderFiles(files) {
  const grid = document.getElementById('batchGrid');
  grid.innerHTML = '';
  
  files.forEach(file => {
    const card = document.createElement('div');
    card.className = 'batch-card';
    card.addEventListener('click', (e) => {
      if (!e.target.closest('button, a')) {
        window.location.href = `/review/file.html?batchId=${batchId}&fileIndex=${file.fileIndex}`;
      }
    });
    
    const confidence = file.confidenceScore !== null 
      ? Math.round(file.confidenceScore * 100) 
      : 0;
    
    card.innerHTML = `
      <img class="batch-card-image" src="${file.viewUrl}" alt="${file.originalName}" loading="lazy" />
      <div class="batch-card-content">
        <div class="batch-card-header">
          <div class="batch-card-title" title="${file.originalName}">${file.originalName}</div>
          ${getStatusBadge(file.status)}
        </div>
        <div class="batch-card-meta">
          <span>Type: ${file.mimeType}</span>
          <span>Size: ${formatFileSize(file.size)}</span>
          ${file.confidenceScore !== null ? `
            <div>
              <span>Confidence: ${confidence}%</span>
              <div class="confidence-bar">
                <div class="confidence-bar-fill" style="width: ${confidence}%"></div>
              </div>
            </div>
          ` : ''}
          ${file.rejectReason ? `<span class="reject-reason">Rejected: ${file.rejectReason}</span>` : ''}
          ${file.errorMessage ? `<span class="error-message">Error: ${file.errorMessage}</span>` : ''}
          ${file.linkedSaleId ? `<span class="confirmed-badge">Confirmed → Sale ${file.linkedSaleId.toString().slice(-8)}</span>` : ''}
        </div>
        <div class="batch-card-actions">
          ${file.status === 'extracted' || file.status === 'needs_review' ? `
            <a href="/review/file.html?batchId=${batchId}&fileIndex=${file.fileIndex}" class="btn btn-primary btn-sm">Review</a>
          ` : ''}
          ${file.linkedSaleId ? `
            <span class="btn btn-secondary btn-sm" style="cursor: default;">Confirmed</span>
          ` : ''}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
  
  if (files.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">No files in this batch</div>';
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function handleBulkConfirm() {
  const btn = document.getElementById('bulkConfirmBtn');
  btn.disabled = true;
  btn.textContent = 'Confirming...';
  
  try {
    const data = await apiFetch(`/batch/${batchId}/confirm-bulk`, {
      method: 'POST',
      body: JSON.stringify({ threshold: 0.85 }),
    });
    
    alert(`Bulk confirm complete:\n- Confirmed: ${data.confirmed.length}\n- Skipped: ${data.skipped.length}\n- Errors: ${data.errors.length}`);
    
    if (data.errors.length > 0) {
      console.error('Bulk confirm errors:', data.errors);
    }
    
    await loadBatch();
  } catch (err) {
    showError('error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm All High Confidence';
  }
}

async function loadQbStatus(businessId) {
  try {
    const data = await apiFetch(`/quickbooks/status/${businessId}`);
    const statusEl = document.getElementById('qbStatus') || createQbStatusElement();
    
    if (data.connected) {
      statusEl.innerHTML = getQbStatusBadge('connected');
      statusEl.style.display = 'inline-flex';
    } else {
      statusEl.innerHTML = getQbStatusBadge(data.status);
      statusEl.style.display = 'inline-flex';
    }
  } catch (err) {
    console.warn('Failed to load QB status:', err);
  }
}

function createQbStatusElement() {
  const el = document.createElement('span');
  el.id = 'qbStatus';
  el.className = 'status-badge';
  el.style.display = 'none';
  document.querySelector('.batch-meta').appendChild(el);
  return el;
}

async function handleSyncAllQuickBooks() {
  const btn = document.getElementById('syncAllQbBtn');
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  
  try {
    const data = await apiFetch(`/quickbooks/sync-batch/${batchId}`, {
      method: 'POST',
    });
    
    let message = `Batch sync complete:\n- Synced: ${data.synced.length}\n- Errors: ${data.errors.length}`;
    if (data.errors.length > 0) {
      message += '\nErrors:\n' + data.errors.map(e => `  ${e.saleId}: ${e.error}`).join('\n');
    }
    alert(message);
    
    if (data.errors.length > 0) {
      console.error('Batch sync errors:', data.errors);
    }
    
    await loadBatch();
  } catch (err) {
    showError('error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sync All to QuickBooks';
  }
}

async function handleExportCsv() {
  const btn = document.getElementById('exportCsvBtn');
  btn.disabled = true;
  btn.textContent = 'Exporting...';
  
  try {
    const response = await fetch(`/api/quickbooks/export/${batchId}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Export failed');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickbooks-expenses-${batchId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    showError('error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Export CSV';
  }
}