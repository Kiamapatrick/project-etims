import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../src/models/index.js';
import { hashPassword } from '../src/utils/password.js';
import { config } from '../src/config/env.js';

async function seedAdmin() {
  try {
    if (!config.admin.email || !config.admin.password) {
      console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables');
      process.exit(1);
    }

    const passwordValidation = config.admin.password.length < 12 ||
      !/[a-zA-Z]/.test(config.admin.password) ||
      !/[0-9]/.test(config.admin.password);
    if (passwordValidation) {
      console.error('Admin password must be at least 12 characters with at least one letter and one number');
      process.exit(1);
    }

    await mongoose.connect(config.mongodbUri, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('Connected to MongoDB');

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.error('Admin user already exists. Aborting.');
      console.error('If you need to reset the admin, delete the existing admin user from the database first.');
      process.exit(1);
    }

    const passwordHash = await hashPassword(config.admin.password);

    const admin = await User.create({
      email: config.admin.email.toLowerCase(),
      passwordHash,
      role: 'admin',
      isActive: true,
    });

    console.log('Admin user created successfully:');
    console.log(`  Email: ${admin.email}`);
    console.log(`  ID: ${admin._id}`);
    console.log(`  Role: ${admin.role}`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding admin:', err.message);
    process.exit(1);
  }
}

seedAdmin();