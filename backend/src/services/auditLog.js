import { AuditLog } from '../models/index.js';
import { diffObjects } from '../utils/diff.js';

export async function logEdit({ documentUploadId, fileIndex, saleId, userId, before, after }) {
  return AuditLog.create({
    documentUploadId,
    fileIndex,
    saleId,
    userId,
    action: 'edited',
    changes: diffObjects(before, after),
    timestamp: new Date(),
  });
}

export async function logConfirm({ documentUploadId, fileIndex, saleId, userId, before, after }) {
  return AuditLog.create({
    documentUploadId,
    fileIndex,
    saleId,
    userId,
    action: 'confirmed',
    changes: diffObjects(before, after),
    timestamp: new Date(),
  });
}

export async function logReject({ documentUploadId, fileIndex, userId, reason }) {
  return AuditLog.create({
    documentUploadId,
    fileIndex,
    saleId: null,
    userId,
    action: 'rejected',
    changes: { rejectReason: { before: null, after: reason } },
    timestamp: new Date(),
  });
}

export async function getAuditLog(documentUploadId, fileIndex) {
  return AuditLog.find({ documentUploadId, fileIndex })
    .populate('userId', 'email role')
    .sort({ timestamp: -1 });
}