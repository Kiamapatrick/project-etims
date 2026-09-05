// POS Logic - Config fetch, dynamic form, validation, submit/queue, background sync, install prompt

const API_BASE = '/api/pos';

let deferredPrompt;
let config = null;
let lineItemCounter = 0;
let isOnline = navigator.onLine;

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  updateOnlineStatus();
  await loadConfig();
  await loadHistory();
  setupInstallPrompt();
  setupServiceWorker();
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});

function setupEventListeners() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  });
  
  document.getElementById('saleForm').addEventListener('submit', handleSubmit);
  document.getElementById('addLineItem').addEventListener('click', () => addLineItemRow());
  document.getElementById('lineItemsBody').addEventListener('input', recalculateTotals);
  document.getElementById('lineItemsBody').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-line-btn')) {
      e.target.closest('tr').remove();
      recalculateTotals();
    }
  });
  document.getElementById('saveDraftBtn').addEventListener('click', saveDraft);
  document.getElementById('installBtn').addEventListener('click', installPWA);
  document.getElementById('dismissInstallBtn').addEventListener('click', dismissInstallBanner);
}

function updateOnlineStatus() {
  isOnline = navigator.onLine;
  const statusEl = document.getElementById('onlineStatus');
  const offlineBanner = document.getElementById('offlineBanner');
  
  if (isOnline) {
    statusEl.textContent = 'Online';
    statusEl.className = 'status-indicator online';
    offlineBanner.style.display = 'none';
  } else {
    statusEl.textContent = 'Offline';
    statusEl.className = 'status-indicator offline';
    offlineBanner.style.display = 'flex';
  }
  updateQueuedCount();
}

async function handleOnline() {
  updateOnlineStatus();
  await syncQueue();
  await loadHistory();
}

function handleOffline() {
  updateOnlineStatus();
}

async function loadConfig() {
  try {
    const data = await apiFetch('/config');
    config = data.config;
    renderDynamicFields(config.fields);
    addLineItemRow(); // Add first empty row
    recalculateTotals();
  } catch (err) {
    console.error('Failed to load config:', err);
    showError('Failed to load POS configuration');
  }
}

function renderDynamicFields(fields) {
  const container = document.getElementById('dynamicFields');
  container.innerHTML = '';
  
  fields.forEach(field => {
    if (field.key === 'vatRate') return; // VAT rate is handled in line items
    
    const group = document.createElement('div');
    group.className = 'form-group';
    
    let inputHtml = '';
    const validation = field.validation || {};
    
    switch (field.type) {
      case 'text':
        inputHtml = `<input type="text" name="${field.key}" id="field_${field.key}" ${validation.minLength ? `minlength="${validation.minLength}"` : ''} ${validation.maxLength ? `maxlength="${validation.maxLength}"` : ''} ${field.required ? 'required' : ''} />`;
        break;
      case 'number':
        inputHtml = `<input type="number" name="${field.key}" id="field_${field.key}" step="${validation.step || 'any'}" ${validation.min !== undefined ? `min="${validation.min}"` : ''} ${field.required ? 'required' : ''} />`;
        break;
      case 'date':
        inputHtml = `<input type="date" name="${field.key}" id="field_${field.key}" ${field.required ? 'required' : ''} />`;
        break;
      case 'select':
        const options = field.options.map(o => `<option value="${o}">${o}</option>`).join('');
        inputHtml = `<select name="${field.key}" id="field_${field.key}" ${field.required ? 'required' : ''}>${options}</select>`;
        break;
      case 'textarea':
        inputHtml = `<textarea name="${field.key}" id="field_${field.key}" rows="3" ${field.required ? 'required' : ''}></textarea>`;
        break;
      default:
        inputHtml = `<input type="text" name="${field.key}" id="field_${field.key}" ${field.required ? 'required' : ''} />`;
    }
    
    group.innerHTML = `
      <label for="field_${field.key}">${field.label}${field.required ? ' *' : ''}</label>
      ${inputHtml}
    `;
    container.appendChild(group);
  });
}

function addLineItemRow(item = {}) {
  const tbody = document.getElementById('lineItemsBody');
  const tr = document.createElement('tr');
  tr.dataset.index = lineItemCounter++;
  
  const vatRate = item.vatRate || (config?.fields?.find(f => f.key === 'vatRate')?.validation?.default || 16);
  const qty = item.quantity || 1;
  const unitPrice = item.unitPrice || 0;
  const vatAmount = (qty * unitPrice * vatRate) / 100;
  const total = qty * unitPrice + vatAmount;
  
  tr.innerHTML = `
    <td><input type="text" name="lineItems[${tr.dataset.index}].description" value="${item.description || ''}" placeholder="Description" required class="col-description" /></td>
    <td><input type="number" step="0.01" min="0.01" name="lineItems[${tr.dataset.index}].quantity" value="${qty}" class="line-qty col-qty" required /></td>
    <td><input type="number" step="0.01" min="0" name="lineItems[${tr.dataset.index}].unitPrice" value="${unitPrice}" class="line-unit-price col-unit-price" required /></td>
    <td><input type="number" step="0.01" min="0" max="100" name="lineItems[${tr.dataset.index}].vatRate" value="${vatRate}" class="line-vat-rate col-vat-rate" required /></td>
    <td><input type="number" step="0.01" min="0" name="lineItems[${tr.dataset.index}].vatAmount" value="${vatAmount.toFixed(2)}" class="line-vat-amount col-vat-amount" readonly /></td>
    <td><input type="number" step="0.01" min="0" name="lineItems[${tr.dataset.index}].totalAmount" value="${total.toFixed(2)}" class="line-total col-total" readonly /></td>
    <td><button type="button" class="remove-line-btn" title="Remove">×</button></td>
  `;
  document.getElementById('lineItemsBody').appendChild(tr);
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
}

function collectFormData() {
  const form = document.getElementById('saleForm');
  const formData = new FormData(form);
  const data = {
    lineItems: [],
  };
  
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('lineItems[')) {
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
    } else if (['saleDate', 'sellerName', 'sellerPin'].includes(key)) {
      data[key] = value;
    }
  }
  
  // Calculate totals from line items
  let subtotal = 0;
  let vatTotal = 0;
  let grandTotal = 0;
  
  data.lineItems = data.lineItems.filter(item => item && item.description);
  
  data.lineItems.forEach(item => {
    const qty = item.quantity || 0;
    const unitPrice = item.unitPrice || 0;
    const vatRate = item.vatRate || 0;
    const lineSubtotal = qty * unitPrice;
    const lineVat = lineSubtotal * vatRate / 100;
    const lineTotal = lineSubtotal + lineVat;
    
    item.vatAmount = lineVat;
    item.totalAmount = lineTotal;
    
    subtotal += lineSubtotal;
    vatTotal += lineVat;
    grandTotal += lineTotal;
  });
  
  data.subtotal = subtotal;
  data.vatAmount = vatTotal;
  data.totalAmount = grandTotal;
  data.saleDate = new Date().toISOString(); // Use current time if not set
  
  return data;
}

async function handleSubmit(e) {
  e.preventDefault();
  hideError('error');
  
  const btn = document.getElementById('submitSaleBtn');
  const draftBtn = document.getElementById('saveDraftBtn');
  btn.disabled = true;
  draftBtn.disabled = true;
  btn.textContent = 'Submitting...';
  
  try {
    const saleData = collectFormData();
    
    if (saleData.lineItems.length === 0) {
      throw new Error('At least one line item is required');
    }
    
    if (isOnline) {
      await apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify(saleData),
      });
      showSuccess('Sale submitted successfully');
      resetForm();
      await loadHistory();
    } else {
      await queueSale(saleData);
      showSuccess('Sale queued for sync (offline)');
      resetForm();
      await loadHistory();
    }
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    draftBtn.disabled = false;
    btn.textContent = 'Submit Sale';
  }
}

async function saveDraft() {
  const saleData = collectFormData();
  if (saleData.lineItems.length === 0) {
    showError('Add at least one line item before saving draft');
    return;
  }
  
  await queueSale(saleData);
  showSuccess('Draft saved locally');
  resetForm();
}

async function queueSale(saleData) {
  const db = await openDB();
  const tx = db.transaction('pendingSales', 'readwrite');
  const store = tx.objectStore('pendingSales');
  
  store.add({ saleData, createdAt: new Date().toISOString(), retries: 0 });
  await txDone(tx);
  updateQueuedCount();
}

async function syncQueue() {
  if (!isOnline) return;
  
  const db = await openDB();
  
  // 1. READ phase — one short transaction
  let pendingItems = [];
  {
    const tx = db.transaction('pendingSales', 'readonly');
    const store = tx.objectStore('pendingSales');
    pendingItems = await promisifyRequest(store.getAll());
    await txDone(tx);
  }
  
  // 2. PROCESS phase — each item gets its own transaction
  for (const item of pendingItems) {
    try {
      await apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify(item.saleData),
      });
      
      // DELETE on success — fresh transaction
      const delTx = db.transaction('pendingSales', 'readwrite');
      const delStore = delTx.objectStore('pendingSales');
      delStore.delete(item.id);
      await txDone(delTx);
      
    } catch (err) {
      // RETRY with increment — fresh transaction
      if (item.retries < 3) {
        const putTx = db.transaction('pendingSales', 'readwrite');
        const putStore = putTx.objectStore('pendingSales');
        putStore.put({ ...item, retries: item.retries + 1 });
        await txDone(putTx);
      } else {
        console.error('Max retries exceeded for sale:', item);
      }
    }
  }
  
  updateQueuedCount();
}

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('eTIMS_POS', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingSales')) {
        const store = db.createObjectStore('pendingSales', { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function updateQueuedCount() {
  try {
    const db = await openDB();
    const tx = db.transaction('pendingSales', 'readonly');
    const store = tx.objectStore('pendingSales');
    const count = await promisifyRequest(store.count());
    await txDone(tx);
    
    const badge = document.getElementById('queuedCount');
    if (badge) badge.textContent = `${count} queued`;
  } catch (err) {
    console.warn('Failed to update queued count:', err);
  }
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function loadHistory() {
  try {
    const data = await apiFetch('/sales?limit=20');
    renderHistory(data.sales);
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

function renderHistory(sales) {
  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = '';
  
  sales.forEach(sale => {
    const tr = document.createElement('tr');
    const itemCount = sale.lineItems?.length || 0;
    const status = sale.posReference ? 'synced' : 'pending';
    
    tr.innerHTML = `
      <td>${formatDate(sale.saleDate)}</td>
      <td><span class="sale-reference">${sale.posReference || sale._id.toString().slice(-8)}</span></td>
      <td>${itemCount}</td>
      <td>${formatCurrency(sale.totalAmount)}</td>
      <td><span class="status-badge status-${status}">${status}</span></td>
    `;
    tbody.appendChild(tr);
  });
  
  if (sales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No sales yet</td></tr>';
  }
}

function resetForm() {
  document.getElementById('saleForm').reset();
  document.getElementById('lineItemsBody').innerHTML = '';
  addLineItemRow();
  recalculateTotals();
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDate(dateString) {
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

function showError(message) {
  // Could add a toast notification here
  console.error('Error:', message);
  alert(message);
}

function showSuccess(message) {
  console.log('Success:', message);
  alert(message);
}

async function apiFetch(path, options = {}) {
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

// PWA Install Prompt
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBanner').style.display = 'flex';
  });
  
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.getElementById('installBanner').style.display = 'none';
  });
}

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      deferredPrompt = null;
      document.getElementById('installBanner').style.display = 'none';
    });
  }
}

function dismissInstallBanner() {
  document.getElementById('installBanner').style.display = 'none';
}

// Service Worker Registration
function setupServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/pos/sw.js')
      .then(reg => {
        console.log('Service Worker registered:', reg.scope);
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateAvailable();
            }
          });
        });
      })
      .catch(err => console.log('Service Worker registration failed:', err));
  }
}

function showUpdateAvailable() {
  if (confirm('A new version of eTIMS POS is available. Reload to update?')) {
    window.location.reload();
  }
}