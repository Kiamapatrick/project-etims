export function generateQuickBooksExpenseCSV(sales) {
  const headers = [
    'Date', 'Account', 'Payee', 'Payment method', 'Ref no.',
    'Description', 'Amount', 'Tax', 'Class', 'Location', 'Memo'
  ];

  const rows = sales.flatMap(sale =>
    sale.lineItems.map(item => [
      sale.saleDate.toISOString().split('T')[0],
      'Expense Account',
      sale.sellerName || 'Unknown Vendor',
      'Cash',
      sale.quickbooksId || sale.cuin || '',
      item.description,
      item.amount,
      item.vatAmount,
      '',
      '',
      `CUIN: ${sale.cuin || 'N/A'} | Source: ${sale.source}`,
    ])
  );

  return [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}