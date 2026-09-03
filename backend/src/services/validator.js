const VAT_TOLERANCE = 0.02;
const TOTAL_TOLERANCE = 0.05;

export function parseAmount(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  const datePatterns = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/,
    /(\d{2})[\/\-.](\d{2})[\/\-.](\d{2})/,
  ];
  
  for (const pattern of datePatterns) {
    const match = value.match(pattern);
    if (match) {
      if (match[1].length === 4) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else {
        const year = parseInt(match[3]);
        const fullYear = year < 50 ? 2000 + year : 1900 + year;
        return new Date(fullYear, parseInt(match[2]) - 1, parseInt(match[1]));
      }
    }
  }
  
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function validateLineItems(lineItems) {
  const errors = [];
  let subtotal = 0;
  let vatTotal = 0;
  
  if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
    errors.push('no_line_items');
    return { valid: false, errors, subtotal: 0, vatTotal: 0 };
  }
  
  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    const qty = parseAmount(item.quantity);
    const unitPrice = parseAmount(item.unitPrice);
    const amount = parseAmount(item.amount);
    const vatRate = parseAmount(item.vatRate);
    const vatAmount = parseAmount(item.vatAmount);
    
    if (qty === null || unitPrice === null || amount === null) {
      errors.push(`line_${i}_missing_amounts`);
      continue;
    }
    
    const expectedAmount = qty * unitPrice;
    if (Math.abs(amount - expectedAmount) > TOTAL_TOLERANCE) {
      errors.push(`line_${i}_amount_mismatch`);
    }
    
    if (vatRate !== null && vatAmount !== null) {
      const expectedVat = (amount * vatRate) / 100;
      if (Math.abs(vatAmount - expectedVat) > VAT_TOLERANCE) {
        errors.push(`line_${i}_vat_mismatch`);
      }
      vatTotal += vatAmount;
    }
    
    subtotal += amount;
  }
  
  return { valid: errors.length === 0, errors, subtotal, vatTotal };
}

export function validateTotals(subtotal, vatAmount, total) {
  const errors = [];
  
  const parsedSubtotal = parseAmount(subtotal);
  const parsedVat = parseAmount(vatAmount);
  const parsedTotal = parseAmount(total);
  
  if (parsedSubtotal === null || parsedVat === null || parsedTotal === null) {
    errors.push('missing_totals');
    return { valid: false, errors };
  }
  
  const expectedTotal = parsedSubtotal + parsedVat;
  if (Math.abs(parsedTotal - expectedTotal) > TOTAL_TOLERANCE) {
    errors.push('totals_mismatch');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateDate(date, fieldName = 'date') {
  const errors = [];
  const parsed = parseDate(date);
  
  if (!parsed) {
    errors.push(`${fieldName}_unparseable`);
    return { valid: false, errors };
  }
  
  const now = new Date();
  if (parsed > now) {
    errors.push(`${fieldName}_in_future`);
  }
  
  const minDate = new Date('2020-01-01');
  if (parsed < minDate) {
    errors.push(`${fieldName}_too_old`);
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateRequiredFields(data, requiredFields) {
  const errors = [];
  for (const field of requiredFields) {
    if (!data[field] && data[field] !== 0) {
      errors.push(`missing_${field}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateExtraction(data) {
  const allErrors = [];
  const warnings = [];
  
  const requiredFields = ['date', 'total', 'lineItems'];
  const fieldValidation = validateRequiredFields(data, requiredFields);
  allErrors.push(...fieldValidation.errors);
  
  if (data.date) {
    const dateValidation = validateDate(data.date, 'date');
    allErrors.push(...dateValidation.errors);
  }
  
  if (data.lineItems) {
    const lineValidation = validateLineItems(data.lineItems);
    allErrors.push(...lineValidation.errors);
    
    if (data.vat !== undefined && data.total !== undefined) {
      const totalsValidation = validateTotals(lineValidation.subtotal, data.vat, data.total);
      allErrors.push(...totalsValidation.errors);
    }
  } else if (data.subtotal !== undefined && data.vat !== undefined && data.total !== undefined) {
    const totalsValidation = validateTotals(data.subtotal, data.vat, data.total);
    allErrors.push(...totalsValidation.errors);
  }
  
  if (data.currency && data.currency !== 'KES') {
    warnings.push('non_kes_currency');
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings,
  };
}