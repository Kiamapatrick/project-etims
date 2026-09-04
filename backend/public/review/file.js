// File Review Logic

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
const fileIndex = parseInt(getUrlParam('fileIndex'), 10);
let currentFile = null;
let currentUpload = null;
let lineItemCounter = 0;

document.addEventListener('DOMContentLoaded', async () => {
  if (!batchId || isNaN(fileIndex)) {
    showError('error', 'Invalid batch ID or file index');
    return;
  }
  
  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  });
  
  document.getElementById('editForm').addEventListener('submit', handleSaveEdits);
  document.getElementById('confirmBtn').addEventListener('click', handleConfirm);
  document.getElementById('syncQbBtn').addEventListener('click', handleSyncQuickBooks);
  document.getElementById('rejectBtn').addEventListener('click', () => openRejectModal());
  document.getElementById('cancelReject').addEventListener('click', closeRejectModal);
  document.getElementById('submitReject').addEventListener('click', handleReject);
  document.getElementById('addLineItem').addEventListener('click', () => addLineItemRow());
  document.getElementById('lineItemsBody').addEventListener('input', recalculateTotals);
  document.getElementById('lineItemsBody').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-line')) {
      e.target.closest('tr').remove();
      recalculateTotals();
    }
  });
  
  await loadFile();
});

async function loadFile() {
  showLoading('loading', true);
  hideError('error');
  
  try {
    const data = await apiFetch(`/batch/${batchId}`);
    currentUpload = data.batch;
    currentFile = data.batch.files[fileIndex];
    
    if (!currentFile) {
      throw new Error('File not found in batch');
    }
    
    renderFile(currentFile, data.batch);
    showElement('formPanel', true);
  } catch (err) {
    showError('error', err.message);
  } finally {
    showLoading('loading', false);
  }
}

function renderFile(file, upload) {
  document.getElementById('fileTitle').textContent = file.originalName;
  document.getElementById('fileStatus').innerHTML = getStatusBadge(file.status);
  
  const confidence = file.confidenceScore !== null
    ? `Confidence: ${Math.round(file.confidenceScore * 100)}%`
    : 'Confidence: N/A';
  document.getElementById('fileConfidence').textContent = confidence;
  
  document.getElementById('receiptImage').src = file.viewUrl;
  
  const extracted = file.extractedData || {};
  
  document.getElementById('field_cuin').value = extracted.cuin || '';
  document.getElementById('field_qrCode').value = extracted.qrCode || '';
  document.getElementById('field_qrVerified').value = extracted.qrVerified ? 'Yes' : 'No';
  document.getElementById('field_source').value = extracted.source || '';
  
  if (extracted.date) {
    const date = new Date(extracted.date);
    document.getElementById('field_date').value = date.toISOString().split('T')[0];
  }
  
  document.getElementById('field_currency').value = extracted.currency || 'KES';
  document.getElementById('field_sellerPin').value = extracted.sellerPin || '';
  document.getElementById('field_sellerName').value = extracted.sellerName || '';
  document.getElementById('field_buyerPin').value = extracted.buyerPin || '';
  document.getElementById('field_subtotal').value = extracted.subtotal !== null ? extracted.subtotal : '';
  document.getElementById('field_vat_amount').value = extracted.vat?.amount !== null ? extracted.vat.amount : '';
  document.getElementById('field_total').value = extracted.total !== null ? extracted.total : '';
  
  renderLineItems(extracted.lineItems || []);
  recalculateTotals();
  
  renderValidationFlags(extracted.validationFlags || []);
  
  const canConfirm = ['extracted', 'needs_review'].includes(file.status) && !file.linkedSaleId;
  document.getElementById('confirmBtn').style.display = canConfirm ? 'inline-flex' : 'none';
  document.getElementById('saveEditsBtn').disabled = file.linkedSaleId ? true : false;
  
  if (file.linkedSaleId) {
    document.getElementById('success').textContent = `Already confirmed → Sale ${file.linkedSaleId.toString().slice(-8)}`;
    document.getElementById('success').style.display = 'block';
  }
  
  // QuickBooks sync button
  if (file.linkedSaleId && !file.quickbooksId) {
    loadQbStatus(upload.businessId);
  } else if (file.quickbooksId) {
    document.getElementById('qbStatus').innerHTML = getQbStatusBadge('connected');
    document.getElementById('qbStatus').style.display = 'inline-flex';
    document.getElementById('syncQbBtn').style.display = 'none';
  } else {
    document.getElementById('qbStatus').style.display = 'none';
    document.getElementById('syncQbBtn').style.display = 'none';
  }
}

function renderLineItems(items) {
  const tbody = document.getElementById('lineItemsBody');
  tbody.innerHTML = '';
  
  items.forEach((item, idx) => {
    addLineItemRow(item, idx);
  });
  
  if (items.length === 0) {
    addLineItemRow();
  }
}

function addLineItemRow(item = {}, index = lineItemCounter++) {
  const tbody = document.getElementById('lineItemsBody');
  const tr = document.createElement('tr');
  tr.dataset.index = index;
  
  const qty = item.quantity || 1;
  const unitPrice = item.unitPrice || 0;
  const vatRate = item.vatRate || 16;
  const vatAmount = (qty * unitPrice * vatRate) / 100;
  const total = qty * unitPrice + vatAmount;
  
  tr.innerHTML = `
    <td><input type="text" name="lineItems[${index}].description" value="${item.description || ''}" placeholder="Description" required /></td>
    <td><input type="number" step="0.01" min="0" name="lineItems[${index}].quantity" value="${qty}" class="line-qty" required /></td>
    <td><input type="number" step="0.01" min="0" name="lineItems[${index}].unitPrice" value="${unitPrice}" class="line-unit-price" required /></td>
    <td><input type="number" step="0.01" min="0" max="100" name="lineItems[${index}].vatRate" value="${vatRate}" class="line-vat-rate" required /></td>
    <td><input type="number" step="0.01" min="0" name="lineItems[${index}].vatAmount" value="${vatAmount.toFixed(2)}" class="line-vat-amount" readonly /></td>
    <td><input type="number" step="0.01" min="0" name="lineItems[${index}].totalAmount" value="${total.toFixed(2)}" class="line-total" readonly /></td>
    <td><button type="button" class="remove-line btn btn-danger btn-sm" title="Remove">×</button></td>
  `;
  tbody.appendChild(tr);
}

function recalculateTotals() {
  const rows = document.querySelectorAll('#lineItemsBody tr');
  let subtotal = 0;
  let vatTotal = 0;
  let grandTotal = 0;
  
  rows.forEach(row => {
    const qty = parseFloat(row.querySelector('.line-qty').value) || 0;
    const unitPrice = parseFloat(row.querySelector('.line-unit-price').value) || 0;
    const vatRate = parseFloat(row.querySelector('.line-vat-rate').value) || 0;
    
    const lineSubtotal = qty * unitPrice;
    const lineVat = lineSubtotal * vatRate / 100;
    const lineTotal = lineSubtotal + lineVat;
    
    row.querySelector('.line-vat-amount').value = lineVat.toFixed(2);
    row.querySelector('.line-total').value = lineTotal.toFixed(2);
    
    subtotal += lineSubtotal;
    vatTotal += lineVat;
    grandTotal += lineTotal;
  });
  
  document.getElementById('totalSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('totalVat').textContent = formatCurrency(vatTotal);
  document.getElementById('totalGrand').textContent = formatCurrency(grandTotal);
  
  document.getElementById('field_subtotal').value = subtotal.toFixed(2);
  document.getElementById('field_vat_amount').value = vatTotal.toFixed(2);
  document.getElementById('field_total').value = grandTotal.toFixed(2);
}

function renderValidationFlags(flags) {
  const container = document.getElementById('validationFlags');
  const list = document.getElementById('flagsList');
  
  if (flags.length > 0) {
    list.innerHTML = flags.map(f => `<li>${f}</li>`).join('');
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

function collectFormData() {
  const form = document.getElementById('editForm');
  const formData = new FormData(form);
  const data = {};
  
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('lineItems[')) {
      if (!data.lineItems) data.lineItems = [];
      const match = key.match(/lineItems\[(\d+)\]\.(.+)/);
      if (match) {
        const idx = parseInt(match[1], 10);
        const field = match[2];
        if (!data.lineItems[idx]) data.lineItems[idx] = {};
        if (['quantity', 'unitPrice', 'vatRate', 'vatAmount', 'totalAmount'].includes(field)) {
          data.lineItems[idx][field] = parseFloat(value) || 0;
        } else {
          data.lineItems[idx][field] = value;
        }
      }
    } else if (['subtotal', 'total', 'vat.amount'].includes(key)) {
      data[key] = parseFloat(value) || 0;
    } else {
      data[key] = value;
    }
  }
  
  if (data.lineItems) {
    data.lineItems = data.lineItems.filter(item => item && item.description);
  }
  
  return data;
}

async function handleSaveEdits(e) {
  e.preventDefault();
  hideError('error');
  hideError('success');
  
  const btn = document.getElementById('saveEditsBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  
  try {
    const editData = collectFormData();
    const data = await apiFetch(`/file/${currentUpload._id}/${fileIndex}`, {
      method: 'PATCH',
      body: JSON.stringify({ editData }),
    });
    
    document.getElementById('success').textContent = 'Edits saved successfully';
    document.getElementById('success').style.display = 'block';
    
    currentFile.extractedData = data.extractedData;
  } catch (err) {
    showError('error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Edits';
  }
}

async function handleConfirm() {
  hideError('error');
  hideError('success');
  
  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  btn.textContent = 'Confirming...';
  
  try {
    const data = await apiFetch(`/file/${currentUpload._id}/${fileIndex}/confirm`, {
      method: 'POST',
    });
    
    if (data.alreadyConfirmed) {
      document.getElementById('success').textContent = `Already confirmed → Sale ${data.sale._id.toString().slice(-8)}`;
    } else {
      document.getElementById('success').textContent = `Sale created successfully (${data.sale._id.toString().slice(-8)})`;
    }
    document.getElementById('success').style.display = 'block';
    
    document.getElementById('confirmBtn').style.display = 'none';
    document.getElementById('saveEditsBtn').disabled = true;
    document.getElementById('rejectBtn').disabled = true;
    
    currentFile.status = 'confirmed';
    currentFile.linkedSaleId = data.sale._id;
    document.getElementById('fileStatus').innerHTML = getStatusBadge('confirmed');
  } catch (err) {
    showError('error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm & Create Sale';
  }
}

function openRejectModal() {
  document.getElementById('rejectReason').value = '';
  document.getElementById('rejectModal').style.display = 'flex';
  document.getElementById('rejectReason').focus();
}

function closeRejectModal() {
  document.getElementById('rejectModal').style.display = 'none';
}

async function handleReject() {
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason) {
    alert('Please provide a reason for rejection');
    return;
  }
  
  const btn = document.getElementById('submitReject');
  btn.disabled = true;
  btn.textContent = 'Rejecting...';
  
  try {
    await apiFetch(`/file/${currentUpload._id}/${fileIndex}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    
    closeRejectModal();
    document.getElementById('success').textContent = 'File rejected';
    document.getElementById('success').style.display = 'block';
    
    document.getElementById('confirmBtn').style.display = 'none';
    document.getElementById('saveEditsBtn').disabled = true;
    document.getElementById('rejectBtn').disabled = true;
    
    currentFile.status = 'rejected';
    currentFile.rejectReason = reason;
    document.getElementById('fileStatus').innerHTML = getStatusBadge('rejected');
    
    await loadFile();
  } catch (err) {
    showError('error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reject';
  }
}

async function loadQbStatus(businessId) {
  try {
    const data = await apiFetch(`/quickbooks/status/${businessId}`);
    const statusEl = document.getElementById('qbStatus');
    const syncBtn = document.getElementById('syncQbBtn');
    
    if (data.connected) {
      statusEl.innerHTML = getQbStatusBadge('connected');
      statusEl.style.display = 'inline-flex';
      if (currentFile.linkedSaleId && !currentFile.quickbooksId) {
        syncBtn.style.display = 'inline-flex';
      }
    } else {
      statusEl.innerHTML = getQbStatusBadge(data.status);
      statusEl.style.display = 'inline-flex';
      syncBtn.style.display = 'none';
    }
  } catch (err) {
    console.warn('Failed to load QB status:', err);
  }
}

async function handleSyncQuickBooks() {
  if (!currentFile.linkedSaleId) {
    showError('error', 'Sale must be confirmed before syncing');
    return;
  }
  
  const btn = document.getElementById('syncQbBtn');
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  
  try {
    const data = await apiFetch(`/quickbooks/sync/${currentFile.linkedSaleId}`, {
      method: 'POST',
    });
    
    document.getElementById('success').textContent = `Synced to QuickBooks (ID: ${data.quickbooksId})`;
    document.getElementById('success').style.display = 'block';
    
    btn.style.display = 'none';
    currentFile.quickbooksId = data.quickbooksId;
    document.getElementById('qbStatus').innerHTML = getQbStatusBadge('connected');
    document.getElementById('qbStatus').style.display = 'inline-flex';
  } catch (err) {
    showError('error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sync to QuickBooks';
  }
}