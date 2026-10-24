require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Set MONGODB_URI in .env before seeding test accounts.');
  const adminEmail = (process.env.TEST_ADMIN_EMAIL || 'admin@stillpoint.test').toLowerCase();
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'StillpointAdmin!26';
  const userEmail = (process.env.TEST_USER_EMAIL || 'guest@stillpoint.test').toLowerCase();
  const userPassword = process.env.TEST_USER_PASSWORD || 'StillpointGuest!26';
  if (adminEmail === userEmail) throw new Error('Admin and user test email addresses must differ.');
  if (adminPassword.length < 8 || userPassword.length < 8) throw new Error('Test passwords must be at least 8 characters.');

  await mongoose.connect(uri);
  for (const account of [
    { name: 'Stillpoint Admin', email: adminEmail, password: adminPassword, role: 'admin' },
    { name: 'Stillpoint Guest', email: userEmail, password: userPassword, role: 'user' }
  ]) {
    account.password = await bcrypt.hash(account.password, 12);
    await User.updateOne({ email: account.email }, { $set: account }, { upsert: true, runValidators: true });
    console.log(`Ready: ${account.role} account ${account.email}`);
  }
  console.log('Test accounts are ready. Change these credentials before any public deployment.');
}

seed().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
