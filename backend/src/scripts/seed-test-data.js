import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User, Business, AccountingFirm, FirmBusinessAccess, ReceiptConfig } from '../models/index.js';
import { hashPassword } from '../utils/password.js';
import { config } from '../config/env.js';

const TEST_PASSWORD = 'TestPass12345';

async function seedTestData() {
  try {
    await mongoose.connect(config.mongodbUri, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('Connected to MongoDB');

    // 1. Create Admin
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      const passwordHash = await hashPassword(TEST_PASSWORD);
      admin = await User.create({
        email: 'admin@etims.test',
        passwordHash,
        role: 'admin',
        isActive: true,
      });
      console.log('Created admin:', admin.email, '| password:', TEST_PASSWORD);
    } else {
      console.log('Admin already exists:', admin.email);
    }

    // 2. Create Business
    let business = await Business.findOne({ pin: 'A001234567B' });
    if (!business) {
      business = await Business.create({
        name: 'Test Business Ltd',
        pin: 'A001234567B',
        address: '123 Test Street, Nairobi',
        contactEmail: 'business@etims.test',
        contactPhone: '+254700000001',
        isActive: true,
        defaultVatRate: 16,
      });
      console.log('Created business:', business.name, '| PIN:', business.pin, '| defaultVatRate:', business.defaultVatRate);
    } else {
      console.log('Business already exists:', business.name);
    }

    // 3. Create Business Staff User
    let staff = await User.findOne({ email: 'staff@etims.test' });
    if (!staff) {
      const passwordHash = await hashPassword(TEST_PASSWORD);
      staff = await User.create({
        email: 'staff@etims.test',
        passwordHash,
        role: 'business_staff',
        businessId: business._id,
        isActive: true,
      });
      console.log('Created business staff:', staff.email, '| businessId:', business._id, '| password:', TEST_PASSWORD);
    } else {
      console.log('Business staff already exists:', staff.email);
    }

    // 4. Create Accounting Firm
    let firm = await AccountingFirm.findOne({ name: 'Test Accounting Firm' });
    if (!firm) {
      firm = await AccountingFirm.create({
        name: 'Test Accounting Firm',
        pin: 'F001234567C',
        address: '456 Firm Ave, Nairobi',
        contactEmail: 'firm@etims.test',
        contactPhone: '+254700000002',
        isActive: true,
      });
      console.log('Created firm:', firm.name, '| PIN:', firm.pin);
    } else {
      console.log('Firm already exists:', firm.name);
    }

    // 5. Create Accountant User
    let accountant = await User.findOne({ email: 'accountant@etims.test' });
    if (!accountant) {
      const passwordHash = await hashPassword(TEST_PASSWORD);
      accountant = await User.create({
        email: 'accountant@etims.test',
        passwordHash,
        role: 'accountant',
        firmId: firm._id,
        isActive: true,
      });
      console.log('Created accountant:', accountant.email, '| firmId:', firm._id, '| password:', TEST_PASSWORD);
    } else {
      console.log('Accountant already exists:', accountant.email);
    }

    // 6. Create FirmBusinessAccess (link firm to business)
    const existingAccess = await FirmBusinessAccess.findOne({ firmId: firm._id, businessId: business._id });
    if (!existingAccess) {
      await FirmBusinessAccess.create({
        firmId: firm._id,
        businessId: business._id,
        accessLevel: 'full',
        grantedBy: admin._id,
      });
      console.log('Created FirmBusinessAccess: firm -> business (full access)');
    } else {
      console.log('FirmBusinessAccess already exists');
    }

    // 7. Seed ReceiptConfig for the business
    const existingConfig = await ReceiptConfig.findOne({ businessId: business._id });
    if (!existingConfig) {
      const { seedDefaultConfig } = await import('../services/receiptConfig.js');
      await seedDefaultConfig(business._id, business.defaultVatRate);
      console.log('Seeded ReceiptConfig for business with defaultVatRate:', business.defaultVatRate);
    } else {
      console.log('ReceiptConfig already exists for business');
    }

    await mongoose.disconnect();
console.log('\n✅ Seed complete. Test credentials:');
console.log('  Admin:       admin@etims.test / TestPass12345');
console.log('  Staff:       staff@etims.test / TestPass12345 (business:', business.name + ')');
console.log('  Accountant:  accountant@etims.test / TestPass12345 (firm:', firm.name + ')');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding test data:', err);
    process.exit(1);
  }
}

seedTestData();