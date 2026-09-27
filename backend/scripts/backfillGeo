require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const Request = require('../models/Request');

(async () => {
  try {
    const mongo = process.env.MONGODB_URI || 'mongodb+srv://chaitanya10205:chay123@cluster0.pkkyn1c.mongodb.net/FODO';
    await mongoose.connect(mongo, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    let updatedDonations = 0;
    const donations = await Donation.find({});
    for (const d of donations) {
      const lat = d?.pickupLocation?.coordinates?.latitude;
      const lng = d?.pickupLocation?.coordinates?.longitude;
      if (typeof lat === 'number' && typeof lng === 'number') {
        // set geo if missing or wrong
        if (!d.pickupLocation.geo || !Array.isArray(d.pickupLocation.geo.coordinates) || d.pickupLocation.geo.coordinates.length !== 2) {
          d.pickupLocation.geo = { type: 'Point', coordinates: [lng, lat] };
          await d.save();
          updatedDonations++;
        }
      }
    }

    let updatedRequests = 0;
    const requests = await Request.find({});
    for (const r of requests) {
      const lat = r?.location?.coordinates?.latitude;
      const lng = r?.location?.coordinates?.longitude;
      if (typeof lat === 'number' && typeof lng === 'number') {
        if (!r.location.geo || !Array.isArray(r.location.geo.coordinates) || r.location.geo.coordinates.length !== 2) {
          r.location.geo = { type: 'Point', coordinates: [lng, lat] };
          await r.save();
          updatedRequests++;
        }
      }
    }

    // Rebuild geospatial indexes
    await Donation.syncIndexes();
    await Request.syncIndexes();

    console.log(`Backfill complete. Donations updated: ${updatedDonations}, Requests updated: ${updatedRequests}`);
  } catch (e) {
    console.error('Backfill error:', e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
