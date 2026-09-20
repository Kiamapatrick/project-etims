import { apiFetch, getToken, clearToken } from '../auth.js';

let lineItemCounter = 0;

document.addEventListener('DOMContentLoaded', async () => {
  await populateBusinessDropdown();
  addLineItemRow();
  recalculateTotals();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    clearToken();
    window.location.href = '/login.html';
  });

  document.getElementById('manualEntryForm').addEventListener('submit', handleSubmit);
  document.getElementById('addLineItem').addEventListener('click', () => addLineItemRow());

  document.getElementById('lineItemsBody').addEventListener('input', recalculateTotals);
  document.getElementById('lineItemsBody').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-line-btn')) {
      e.target.closest('tr').remove();
      recalculateTotals();
    }
  });
}

async function populateBusinessDropdown() {
  try {
    const res = await apiFetch('/api/businesses');
    const data = await res.json();
    const select = document.getElementById('businessId');
    if (data.businesses) {
      data.businesses.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b._id;
        opt.textContent = `${b.name} (${b.pin})`;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.warn('Failed to load businesses:', err);
  }
}

function addLineItemRow(item = {}) {
  const tbody = document.getElementById('lineItemsBody');
  const tr = document.createElement('tr');
  tr.dataset.index = lineItemCounter++;

  const vatRate = item.vatRate || 16;
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
  tbody.appendChild(tr);
}

function recalculateTotals() {
  const rows = document.querySelectorAll('#lineItemsBody tr');
  let subtotal = 0, vatTotal = 0, grandTotal = 0;

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

async function handleSubmit(e) {
  e.preventDefault();
  hideMessage();

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  try {
    const form = document.getElementById('manualEntryForm');
    const formData = new FormData(form);
    const lineItems = [];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('lineItems[')) {
        const match = key.match(/lineItems\[(\d+)\]\.(.+)/);
        if (match) {
          const idx = parseInt(match[1], 10);
          const field = match[2];
          if (!lineItems[idx]) lineItems[idx] = {};
          if (['quantity', 'unitPrice', 'vatRate', 'vatAmount', 'totalAmount'].includes(field)) {
            lineItems[idx][field] = parseFloat(value) || 0;
          } else {
            lineItems[idx][field] = value;
          }
        }
      }
    }

    const validItems = lineItems.filter(item => item && item.description);
    if (validItems.length === 0) {
      throw new Error('At least one line item with description is required');
    }

    let subtotal = 0, vatTotal = 0, grandTotal = 0;
    validItems.forEach(item => {
      const lineSubtotal = item.quantity * item.unitPrice;
      const lineVat = lineSubtotal * item.vatRate / 100;
      const lineTotal = lineSubtotal + lineVat;
      item.vatAmount = lineVat;
      item.totalAmount = lineTotal;
      subtotal += lineSubtotal;
      vatTotal += lineVat;
      grandTotal += lineTotal;
    });

    const payload = {
      businessId: formData.get('businessId'),
      saleDate: formData.get('saleDate'),
      totalAmount: grandTotal,
      vatAmount: vatTotal,
      sellerName: formData.get('sellerName') || '',
      sellerPin: formData.get('sellerPin') || '',
      lineItems: validItems,
    };

    const res = await apiFetch('/api/sales/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

    showMessage('Sale submitted successfully', 'success');
    resetForm();
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Sale';
  }
}

function resetForm() {
  document.getElementById('manualEntryForm').reset();
  document.getElementById('lineItemsBody').innerHTML = '';
  addLineItemRow();
  recalculateTotals();
}

function showMessage(text, type) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = `message ${type}`;
  el.style.display = 'block';
}

function hideMessage() {
  const el = document.getElementById('message');
  el.style.display = 'none';
  el.className = 'message';
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount || 0);
}