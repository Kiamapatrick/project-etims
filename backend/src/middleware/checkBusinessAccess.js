import { FirmBusinessAccess } from '../models/index.js';

export async function checkBusinessAccess(user, businessId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'business_staff') {
    return user.businessId?.toString() === businessId;
  }
  if (user.role === 'accountant') {
    if (!user.firmId) return false;
    const access = await FirmBusinessAccess.findOne({
      firmId: user.firmId,
      businessId,
      revokedAt: null,
    });
    return !!access;
  }
  return false;
}