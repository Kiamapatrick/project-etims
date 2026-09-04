import { ReceiptConfig } from '../models/index.js';

const DEFAULT_FIELDS = [
  {
    key: 'description',
    label: 'Item Description',
    type: 'text',
    required: true,
    options: [],
    validation: { minLength: 1, maxLength: 500 },
  },
  {
    key: 'quantity',
    label: 'Quantity',
    type: 'number',
    required: true,
    options: [],
    validation: { min: 0.01, step: 0.01 },
  },
  {
    key: 'unitPrice',
    label: 'Unit Price (KES)',
    type: 'number',
    required: true,
    options: [],
    validation: { min: 0, step: 0.01 },
  },
  {
    key: 'vatRate',
    label: 'VAT Rate (%)',
    type: 'number',
    required: true,
    options: [],
    validation: { min: 0, max: 100, step: 0.01 },
  },
];

export async function getDefaultConfig(businessId) {
  return {
    businessId,
    fields: DEFAULT_FIELDS.map(f => ({ ...f })),
    version: 1,
  };
}

export async function seedDefaultConfig(businessId, defaultVatRate = 16) {
  const existing = await ReceiptConfig.findOne({ businessId });
  if (existing) {
    return existing;
  }

  const fields = DEFAULT_FIELDS.map(f => {
    if (f.key === 'vatRate') {
      return { ...f, validation: { ...f.validation, default: defaultVatRate } };
    }
    return { ...f };
  });

  return ReceiptConfig.create({
    businessId,
    fields,
    version: 1,
  });
}

export async function getConfig(businessId) {
  return ReceiptConfig.findOne({ businessId }).lean();
}

export async function upsertConfig(businessId, fields, _userId) {
  const existing = await ReceiptConfig.findOne({ businessId });
  if (existing) {
    existing.fields = fields;
    existing.version += 1;
    await existing.save();
    return existing;
  }
  return ReceiptConfig.create({
    businessId,
    fields,
    version: 1,
  });
}

export async function seedAllBusinesses() {
  const { Business } = await import('../models/index.js');
  const businesses = await Business.find({ isActive: true }).lean();
  
  for (const biz of businesses) {
    await seedDefaultConfig(biz._id, biz.defaultVatRate);
  }
}