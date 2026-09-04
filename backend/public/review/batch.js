// Batch Grid Logic

import { apiFetch, formatDate, formatCurrency, getStatusBadge, getUrlParam, showError, hideError, showLoading, showElement } from './review.js';

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