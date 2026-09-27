import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { initSocket } from '../../utils/socket';
import MapView from '../../components/MapView';
import ProfileSidebar from '../../components/ProfileSidebar';
import { getCurrentPosition } from '../../utils/geolocate';

export default function NGODashboard() {
  const { user, setUser } = useAuth();
  const [donations, setDonations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(10000); // meters
  const [coords, setCoords] = useState({
    latitude: user?.location?.coordinates?.latitude || 0,
    longitude: user?.location?.coordinates?.longitude || 0,
  });

  useEffect(() => {
    const s = initSocket();
    if (user?._id) s.emit('join-room', user._id);
  }, [user]);

  const center = useMemo(() => [
    coords?.latitude || 20.5937,
    coords?.longitude || 78.9629
  ], [coords]);

  const fetchNearby = async () => {
    if (!coords?.latitude || !coords?.longitude) return;
    try {
      setLoading(true);
      const { latitude, longitude } = coords;
      const [dRes, rRes] = await Promise.all([
        api.get('/donations', { params: { latitude, longitude, radius, status: 'active', limit: 20 } }),
        api.get('/requests', { params: { latitude, longitude, radius, status: 'pending', limit: 20 } })
      ]);
      setDonations(dRes.data.donations || []);
      setRequests(rRes.data.requests || []);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchDeliveries = async () => {
    try {
      const { data } = await api.get('/deliveries/active');
      setDeliveries(data.deliveries || []);
    } catch {}
  };

  useEffect(() => { fetchNearby(); fetchDeliveries(); }, []);

  const handleUseGPS = async () => {
    try {
      const pos = await getCurrentPosition();
      setCoords({ latitude: pos.latitude, longitude: pos.longitude });
      toast.info(`GPS set to ${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`);
    } catch (e) {
      toast.error('Unable to get GPS location');
    }
  };

  const saveLocation = async () => {
    try {
      const latitude = parseFloat(coords.latitude);
      const longitude = parseFloat(coords.longitude);
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        toast.error('Please enter valid coordinates');
        return;
      }
      const address = user?.location?.address || 'Updated via dashboard';
      await api.put('/auth/profile', {
        location: { address, coordinates: { latitude, longitude } }
      });
      toast.success('Location saved');
      fetchNearby();
    } catch (e) {}
  };

  const createDelivery = async (donationId, requestId) => {
    try {
      const { data } = await api.post('/deliveries', { donationId, requestId });
      toast.success('Delivery created');
      setDeliveries(prev => [data.delivery, ...prev]);
      // refresh lists
      fetchNearby();
    } catch (e) {
      const errorMessage = e?.response?.data?.message || 'Failed to create delivery';
      toast.error(errorMessage);
      console.error('Create delivery error:', e?.response?.data || e);
    }
  };

  const startPickup = async (deliveryId) => {
    try {
      const { data } = await api.put(`/deliveries/${deliveryId}/start-pickup`);
      toast.info('Pickup started');
      setDeliveries(prev => prev.map(d => d._id === deliveryId ? data.delivery : d));
    } catch {}
  };

  const completePickup = async (deliveryId) => {
    try {
      const { data } = await api.put(`/deliveries/${deliveryId}/complete-pickup`, { foodCondition: 'good' });
      toast.success('Pickup completed');
      setDeliveries(prev => prev.map(d => d._id === deliveryId ? data.delivery : d));
    } catch {}
  };

  const completeDelivery = async (deliveryId) => {
    try {
      const { data } = await api.put(`/deliveries/${deliveryId}/complete-delivery`, { foodCondition: 'excellent' });
      toast.success(`Delivered. Points earned: ${data.pointsEarned}`);
      setDeliveries(prev => prev.map(d => d._id === deliveryId ? data.delivery : d));
      // Refresh profile to update points in sidebar
      try {
        const me = await api.get('/auth/me');
        setUser(me.data.user);
      } catch {}
    } catch {}
  };

  const donationMarkers = useMemo(() => (donations || []).map(d => ({
    lat: d.pickupLocation?.coordinates?.latitude,
    lng: d.pickupLocation?.coordinates?.longitude,
    color: d.status === 'active' ? 'green' : 'yellow',
    popup: `<strong>${d.foodType}</strong> • ${d.quantity.amount} ${d.quantity.unit}`
  })).filter(m => m.lat && m.lng), [donations]);

  const requestMarkers = useMemo(() => (requests || []).map(r => ({
    lat: r.location?.coordinates?.latitude,
    lng: r.location?.coordinates?.longitude,
    color: r.status === 'pending' ? 'yellow' : 'red',
    popup: `<strong>${r.title}</strong> • Urgency: ${r.urgency}`
  })).filter(m => m.lat && m.lng), [requests]);

  return (
    <div className="container py-4 fade-in">
      <div className="d-flex align-items-center mb-4">
        <div className="me-3">
          <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center" style={{width: '60px', height: '60px'}}>
            <i className="bi bi-people-fill text-white fs-4"></i>
          </div>
        </div>
        <div>
          <h3 className="mb-1">NGO Dashboard</h3>
          <p className="text-muted mb-0">Connect donors with requesters and deliver hope</p>
        </div>
      </div>

      {(!coords.latitude || !coords.longitude) && (
        <div className="alert alert-warning">Your location coordinates are missing. Use GPS or enter your latitude and longitude, then save.</div>
      )}

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label">Latitude</label>
              <input className="form-control" type="number" step="any" value={coords.latitude}
                     onChange={(e)=>setCoords(c=>({...c, latitude: parseFloat(e.target.value)}))} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Longitude</label>
              <input className="form-control" type="number" step="any" value={coords.longitude}
                     onChange={(e)=>setCoords(c=>({...c, longitude: parseFloat(e.target.value)}))} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Radius (meters)</label>
              <input className="form-control" type="number" value={radius}
                     onChange={(e)=>setRadius(parseInt(e.target.value || '0', 10))} />
            </div>
            <div className="col-md-4 d-flex gap-1 flex-wrap">
              <button className="btn btn-outline-secondary btn-sm" onClick={handleUseGPS}>Use GPS</button>
              <button className="btn btn-outline-primary btn-sm" onClick={saveLocation}>Save Location</button>
              <button className="btn btn-primary btn-sm" onClick={fetchNearby} disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-3">
          <ProfileSidebar />
        </div>
        <div className="col-lg-9">
          <div className="row g-4 mb-4">
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <span>Nearby Donations</span>
                  <button className="btn btn-sm btn-outline-secondary" onClick={fetchNearby} disabled={loading}>Refresh</button>
                </div>
                <div className="card-body" style={{ maxHeight: 350, overflow: 'auto' }}>
                  {(donations || []).length === 0 && <p className="text-muted">No nearby donations.</p>}
                  {donations.map(d => (
                    <div key={d._id} className="border rounded p-2 mb-2">
                      <div className="d-flex justify-content-between">
                        <strong>{d.foodType}</strong>
                        <span className="badge bg-success">{d.status}</span>
                      </div>
                      <small>Qty: {d.quantity.amount} {d.quantity.unit} • Category: {d.category}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <span>Nearby Requests</span>
                  <button className="btn btn-sm btn-outline-secondary" onClick={fetchNearby} disabled={loading}>Refresh</button>
                </div>
                <div className="card-body" style={{ maxHeight: 350, overflow: 'auto' }}>
                  {(requests || []).length === 0 && <p className="text-muted">No nearby requests.</p>}
                  {requests.map(r => (
                    <div key={r._id} className="border rounded p-2 mb-2">
                      <div className="d-flex justify-content-between">
                        <strong>{r.title}</strong>
                        <span className="badge bg-warning text-dark">{r.status}</span>
                      </div>
                      <small>Urgency: {r.urgency} • People: {r.numberOfPeople}</small>
                      <div className="mt-2">
                        {/* Simple matching: pick first donation if exists */}
                        <button className="btn btn-sm btn-primary"
                          onClick={() => {
                            const d = donations.find(dd => dd.status === 'active');
                            if (!d) return toast.info('No active donations to match.');
                            createDelivery(d._id, r._id);
                          }}>Accept & Create Delivery</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header">Active Deliveries</div>
                <div className="card-body" style={{ maxHeight: 360, overflow: 'auto' }}>
                  {(deliveries || []).length === 0 && <p className="text-muted">No active deliveries.</p>}
                  {deliveries.map(d => (
                    <div key={d._id} className="border rounded p-2 mb-2">
                      <div className="d-flex justify-content-between">
                        <strong>{d.donation?.foodType}</strong>
                        <span className="badge bg-secondary">{d.deliveryStatus}</span>
                      </div>
                      <small>To: {d.requester?.name} • From: {d.donor?.name}</small>
                      <div className="mt-2 d-flex gap-2">
                        {d.deliveryStatus === 'assigned' && (
                          <button className="btn btn-sm btn-outline-primary" onClick={() => startPickup(d._id)}>Start Pickup</button>
                        )}
                        {d.deliveryStatus === 'pickup_in_progress' && (
                          <button className="btn btn-sm btn-outline-success" onClick={() => completePickup(d._id)}>Complete Pickup</button>
                        )}
                        {d.deliveryStatus === 'delivery_in_progress' && (
                          <button className="btn btn-sm btn-success" onClick={() => completeDelivery(d._id)}>Complete Delivery</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header">Map</div>
                <div className="card-body">
                  <MapView center={center} markers={[...donationMarkers, ...requestMarkers]} height={360} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
