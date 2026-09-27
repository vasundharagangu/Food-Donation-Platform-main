require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  try {
    const mongo = process.env.MONGODB_URI || 'mongodb+srv://chaitanya10205:chay123@cluster0.pkkyn1c.mongodb.net/FODO';
    await mongoose.connect(mongo, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const email = process.env.ADMIN_EMAIL || 'admin123@gmail.com';
    const phone = process.env.ADMIN_PHONE || '9999999999';
    const password = process.env.ADMIN_PASSWORD || 'admin123';

    let admin = await User.findOne({ email });
    if (admin) {
      console.log('Admin already exists:', email);
      if ((process.env.ADMIN_FORCE_RESET || '').toLowerCase() === 'true') {
        console.log('ADMIN_FORCE_RESET=true -> resetting admin password');
        admin.password = password;
        admin.isActive = true;
        if (process.env.ADMIN_PHONE) admin.phone = process.env.ADMIN_PHONE;
        await admin.save();
        console.log('Admin password reset complete');
      }
    } else {
      admin = new User({
        name: 'Administrator',
        email,
        phone,
        password,
        role: 'admin',
        location: {
          address: 'HQ',
          coordinates: { latitude: 28.6139, longitude: 77.2090 }
        },
        isApproved: true
      });
      await admin.save();
      console.log('Admin created:', email);
    }
  } catch (e) {
    console.error('Seed admin error:', e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
