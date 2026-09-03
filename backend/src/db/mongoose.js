import mongoose from 'mongoose';
import { config } from '../config/env.js';

let isConnected = false;

export async function connectDB() {
  if (isConnected) {
    console.log('MongoDB already connected');
    return;
  }

  try {
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected successfully');
      isConnected = true;
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      isConnected = false;
    });

    await mongoose.connect(config.mongodbUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('MongoDB disconnected gracefully');
}

export function getConnectionStatus() {
  return {
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };
}