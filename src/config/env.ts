import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/study-schedule-tracker',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || 'BAm-caTg4byJXM8DmEDdVdaeaDy5wIZkNPAmyoYP1Rnf4E6Wl1whYRRgujHgrMLE2fkEYjAS4OvVAT5NlbS1D9Q',
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || '7Pdaj_iUfrG3XEsseMXQ7ruxyPI_bH0iNYhD7PqZo7c',
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:admin@studyschedule.local',
};
