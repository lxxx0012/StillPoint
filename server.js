require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'development-only-change-me';
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '30kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40 }));

const userSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, password: { type: String, required: true }, role: { type: String, enum: ['user', 'admin'], default: 'user' } }, { timestamps: true });
const eventSchema = new mongoose.Schema({ title: { type: String, required: true, trim: true }, slug: { type: String, required: true, unique: true, lowercase: true }, category: { type: String, default: 'Community' }, date: { type: Date, required: true }, endDate: Date, location: { type: String, required: true }, description: { type: String, default: '' }, image: { type: String, default: '' }, destinationUrl: { type: String, required: true }, capacity: { type: Number, default: 100 }, featured: { type: Boolean, default: false }, active: { type: Boolean, default: true } }, { timestamps: true });
const registrationSchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true }, registeredAt: { type: Date, default: Date.now } });
registrationSchema.index({ user: 1, event: 1 }, { unique: true });
const User = mongoose.model('User', userSchema), Event = mongoose.model('Event', eventSchema), Registration = mongoose.model('Registration', registrationSchema);

function tokenFor(user) { return jwt.sign({ id: user._id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' }); }
function auth(req, res, next) { const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { return res.status(401).json({ message: 'Please sign in to continue.' }); } }
function admin(req, res, next) { if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' }); next(); }
function safeEvent(event) { const e = event.toObject ? event.toObject() : event; return { ...e, registered: e.registered || false, registrationCount: e.registrationCount || 0 }; }
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 8) return res.status(400).json({ message: 'Enter your name, a valid email, and a password of at least 8 characters.' });
  const normalized = email.trim().toLowerCase();
  if (await User.exists({ email: normalized })) return res.status(409).json({ message: 'An account with that email already exists.' });
  const role = normalized === (process.env.ADMIN_EMAIL || '').toLowerCase() ? 'admin' : 'user';
  const user = await User.create({ name: name.trim(), email: normalized, password: await bcrypt.hash(password, 12), role });
  res.status(201).json({ token: tokenFor(user), user: { name: user.name, email: user.email, role: user.role } });
}));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').trim().toLowerCase() });
  if (!user || !await bcrypt.compare(req.body.password || '', user.password)) return res.status(401).json({ message: 'Email or password is incorrect.' });
  res.json({ token: tokenFor(user), user: { name: user.name, email: user.email, role: user.role } });
}));
app.get('/api/auth/me', auth, asyncRoute(async (req, res) => { const user = await User.findById(req.user.id).select('name email role'); if (!user) return res.status(401).json({ message: 'Account not found.' }); res.json({ user }); }));

app.get('/api/events', asyncRoute(async (req, res) => {
  const filter = req.query.all === 'true' ? {} : { active: true };
  const events = await Event.find(filter).sort({ date: 1 }).lean();
  const ids = events.map(e => e._id);
  const counts = await Registration.aggregate([{ $match: { event: { $in: ids } } }, { $group: { _id: '$event', count: { $sum: 1 } } }]);
  const countMap = Object.fromEntries(counts.map(c => [String(c._id), c.count]));
  let registered = new Set();
  if (req.headers.authorization) { try { const u = jwt.verify(req.headers.authorization.replace(/^Bearer\s+/i, ''), JWT_SECRET); const rows = await Registration.find({ user: u.id, event: { $in: ids } }).select('event'); registered = new Set(rows.map(r => String(r.event))); } catch {} }
  res.json(events.map(e => safeEvent({ ...e, registrationCount: countMap[String(e._id)] || 0, registered: registered.has(String(e._id)) })));
}));
app.get('/api/events/:id/qr', auth, admin, asyncRoute(async (req, res) => {
  const event = await Event.findById(req.params.id); if (!event) return res.status(404).json({ message: 'Event not found.' });
  const url = `${(process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')}/go/${event.slug}`;
  res.json({ url, dataUrl: await QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: '#183b35', light: '#ffffff' }, errorCorrectionLevel: 'H' }) });
}));
app.post('/api/events/:id/register', auth, asyncRoute(async (req, res) => {
  const event = await Event.findById(req.params.id); if (!event || !event.active) return res.status(404).json({ message: 'This event is no longer available.' });
  if (event.date < new Date()) return res.status(400).json({ message: 'This event has already passed.' });
  const count = await Registration.countDocuments({ event: event._id }); if (count >= event.capacity) return res.status(409).json({ message: 'This event is full.' });
  try { await Registration.create({ user: req.user.id, event: event._id }); } catch (e) { if (e.code === 11000) return res.status(409).json({ message: 'You are already registered.' }); throw e; }
  res.status(201).json({ message: 'You’re on the list. See you there.' });
}));
app.delete('/api/events/:id/register', auth, asyncRoute(async (req, res) => { await Registration.deleteOne({ user: req.user.id, event: req.params.id }); res.json({ message: 'Registration cancelled.' }); }));
app.get('/api/me/registrations', auth, asyncRoute(async (req, res) => {
  const regs = await Registration.find({ user: req.user.id }).populate('event').sort({ registeredAt: -1 });
  res.json(regs.filter(r => r.event).map(r => ({ ...safeEvent(r.event), registeredAt: r.registeredAt, past: r.event.date < new Date() })));
}));

app.post('/api/admin/events', auth, admin, asyncRoute(async (req, res) => {
  const data = validateEvent(req.body); const event = await Event.create(data); res.status(201).json(safeEvent(event));
}));
app.put('/api/admin/events/:id', auth, admin, asyncRoute(async (req, res) => {
  const data = validateEvent(req.body); const event = await Event.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }); if (!event) return res.status(404).json({ message: 'Event not found.' }); res.json(safeEvent(event));
}));
app.delete('/api/admin/events/:id', auth, admin, asyncRoute(async (req, res) => { const e = await Event.findByIdAndUpdate(req.params.id, { active: false }, { new: true }); if (!e) return res.status(404).json({ message: 'Event not found.' }); res.json({ message: 'Event archived. Its QR code now shows an unavailable notice.' }); }));
function validateEvent(body) {
  const title = (body.title || '').trim(), location = (body.location || '').trim(), destinationUrl = (body.destinationUrl || '').trim(), date = new Date(body.date);
  if (!title || !location || !body.date || isNaN(date) || !/^https?:\/\//i.test(destinationUrl)) { const e = new Error('Add a title, location, valid date and a destination URL beginning with https:// or http://.'); e.status = 400; throw e; }
  const slug = (body.slug || title).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { title, slug, location, date, category: (body.category || 'Community').trim(), description: (body.description || '').trim(), destinationUrl, image: (body.image || '').trim(), capacity: Math.max(1, Number(body.capacity) || 100), featured: Boolean(body.featured), active: body.active !== false };
}
app.get('/go/:slug', asyncRoute(async (req, res) => { const e = await Event.findOne({ slug: req.params.slug }); if (!e) return res.status(404).sendFile(path.join(__dirname, 'public', 'unavailable.html')); if (!e.active) return res.status(410).sendFile(path.join(__dirname, 'public', 'unavailable.html')); res.redirect(302, e.destinationUrl); }));
app.use('/api', (err, req, res, next) => { console.error(err); res.status(err.status || (err.code === 11000 ? 409 : 500)).json({ message: err.status ? err.message : err.code === 11000 ? 'That event slug is already in use.' : 'Something went wrong. Please try again.' }); });
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const seed = [
  { title: 'A slower kind of Sunday', slug: 'slower-sunday', category: 'Wellbeing', date: '2026-11-15T10:00:00-05:00', location: 'The Conservatory · Toronto', description: 'A gentle morning of guided breathwork, seasonal tea, and room to simply be. Come as you are; leave a little lighter.', image: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1000&q=85', destinationUrl: 'https://example.com/events/slower-sunday', capacity: 28, featured: true },
  { title: 'Gather around the table', slug: 'gather-table', category: 'Food & drink', date: '2026-11-21T18:30:00-05:00', location: 'Little Fern Kitchen · Toronto', description: 'A long-table supper celebrating the last harvest. Five thoughtful courses, local growers, and new friends.', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=85', destinationUrl: 'https://example.com/events/gather-table', capacity: 24, featured: false },
  { title: 'Make room for making', slug: 'room-for-making', category: 'Creative', date: '2026-12-04T13:00:00-05:00', location: 'Studio June · Leslieville', description: 'An unhurried afternoon with clay, good company, and a little permission to make something imperfect.', image: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1000&q=85', destinationUrl: 'https://example.com/events/room-for-making', capacity: 18, featured: true },
  { title: 'Winter light walk', slug: 'winter-light-walk', category: 'Outdoors', date: '2026-12-12T16:00:00-05:00', location: 'Evergreen Brick Works · Toronto', description: 'A quiet guided walk as the city turns toward winter. Warm up together after with something hot.', image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1000&q=85', destinationUrl: 'https://example.com/events/winter-light-walk', capacity: 40, featured: false }
];
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stillpoint').then(async () => {
  for (const item of seed) await Event.updateOne({ slug: item.slug }, { $setOnInsert: item }, { upsert: true });
  app.listen(PORT, () => console.log(`Stillpoint is listening at http://localhost:${PORT}`));
}).catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
