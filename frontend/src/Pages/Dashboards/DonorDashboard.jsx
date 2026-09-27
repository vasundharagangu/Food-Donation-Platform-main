import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { initSocket } from '../../utils/socket';
import MapView from '../../components/MapView';
import ProfileSidebar from '../../components/ProfileSidebar';
import { autofillUserCoords } from '../../utils/geolocate';

export default function DonorDashboard() {
  const { user } = useAuth();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: {
      foodType: '',
      description: '',
      quantity: { amount: 1, unit: 'kg' },
      category: 'cooked_food',
      expiryTime: '',
      pickupLocation: {
        address: user?.location?.address || '',
        coordinates: {
          latitude: user?.location?.coordinates?.latitude || 0,
          longitude: user?.location?.coordinates?.longitude || 0,
        },
        instructions: ''
      },
      deliveryMethod: 'self_delivery',
      images: []
    }
  });

  useEffect(() => {
    const s = initSocket();
    if (user?._id) s.emit('join-room', user._id);
  }, [user]);

  const center = useMemo(() => [
    user?.location?.coordinates?.latitude || 20.5937,
    user?.location?.coordinates?.longitude || 78.9629
  ], [user]);

  const fetchDonations = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/donations');
      setDonations(data.donations || []);
    } catch (e) {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDonations(); }, []);

  const onCreate = async (values) => {
    try {
      values.quantity.amount = parseFloat(values.quantity.amount);
      values.pickupLocation.coordinates.latitude = parseFloat(values.pickupLocation.coordinates.latitude);
      values.pickupLocation.coordinates.longitude = parseFloat(values.pickupLocation.coordinates.longitude);
      const { data } = await api.post('/donations', values);
      toast.success('Donation created');
      reset();
      setDonations(prev => [data.donation, ...prev]);
    } catch (e) {
      const errorMessage = e?.response?.data?.message || 'Failed to create donation';
      toast.error(errorMessage);
      console.error('Create donation error:', e?.response?.data || e);
    }
  };

  const markers = useMemo(() => {
    return donations.filter(d => d.pickupLocation?.coordinates).map(d => ({
      lat: d.pickupLocation.coordinates.latitude,
      lng: d.pickupLocation.coordinates.longitude,
      color: d.status === 'active' ? 'green' : (d.status === 'assigned_to_ngo' ? 'yellow' : 'blue'),
      popup: `<strong>${d.foodType}</strong><br/>Qty: ${d.quantity.amount} ${d.quantity.unit}<br/>Status: ${d.status}`
    }));
  }, [donations]);

  return (
    <div className="container py-4 fade-in">
      <div className="d-flex align-items-center mb-4">
        <div className="me-3">
          <div className="bg-success rounded-circle d-flex align-items-center justify-content-center" style={{width: '60px', height: '60px'}}>
            <i className="bi bi-heart-fill text-white fs-4"></i>
          </div>
        </div>
        <div>
          <h3 className="mb-1">Donor Dashboard</h3>
          <p className="text-muted mb-0">Share your surplus food and make a difference</p>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-3">
          <ProfileSidebar />
        </div>
        <div className="col-lg-9">
      <div className="card mb-4">
        <div className="card-header">Add Surplus Food</div>
        <div className="card-body">
          <form onSubmit={handleSubmit(onCreate)} className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Food Type</label>
              <input className="form-control" {...register('foodType', { required: true })} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Category</label>
              <select className="form-select" {...register('category', { required: true })}>
                <option value="cooked_food">Cooked</option>
                <option value="raw_ingredients">Raw Ingredients</option>
                <option value="packaged_food">Packaged</option>
                <option value="beverages">Beverages</option>
                <option value="dairy">Dairy</option>
                <option value="fruits_vegetables">Fruits & Vegetables</option>
                <option value="bakery">Bakery</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Qty</label>
              <input className="form-control" type="number" step="any" {...register('quantity.amount', { required: true, min: 1 })} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Unit</label>
              <select className="form-select" {...register('quantity.unit', { required: true })}>
                <option>kg</option>
                <option>grams</option>
                <option>pieces</option>
                <option>plates</option>
                <option>boxes</option>
                <option>liters</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Expiry Time</label>
              <input className="form-control" type="datetime-local" {...register('expiryTime', { required: true })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Delivery Method</label>
              <select className="form-select" {...register('deliveryMethod', { required: true })}>
                <option value="self_delivery">Self Delivery</option>
                <option value="ngo_pickup">Assign to Nearby NGO</option>
              </select>
            </div>
            <div className="col-md-8">
              <label className="form-label">Pickup Address</label>
              <input className="form-control" {...register('pickupLocation.address', { required: true })} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Lat</label>
              <input className="form-control" type="number" step="any" {...register('pickupLocation.coordinates.latitude', { required: true })} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Lng</label>
              <input className="form-control" type="number" step="any" {...register('pickupLocation.coordinates.longitude', { required: true })} />
            </div>
            <div className="col-12">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={async()=>{
                try {
                  const { latitude, longitude } = await autofillUserCoords(setValue);
                  // Manually set the donor form fields
                  setValue('pickupLocation.coordinates.latitude', latitude);
                  setValue('pickupLocation.coordinates.longitude', longitude);
                  toast.info(`GPS set to ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                } catch (e) {
                  toast.error('Unable to get GPS location');
                }
              }}>Use GPS</button>
            </div>
            <div className="col-12">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows={2} {...register('description')} />
            </div>
            <div className="col-12">
              <button className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add Donation'}</button>
            </div>
          </form>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Your Donations</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={fetchDonations} disabled={loading}>
                Refresh
              </button>
            </div>
            <div className="card-body" style={{ maxHeight: 400, overflow: 'auto' }}>
              {donations.length === 0 && <p className="text-muted">No donations yet.</p>}
              {donations.map(d => (
                <div className="border rounded p-2 mb-2" key={d._id}>
                  <div className="d-flex justify-content-between">
                    <strong>{d.foodType}</strong>
                    <span className={`badge bg-${d.status === 'active' ? 'success' : d.status.includes('assigned') ? 'warning' : 'secondary'}`}>{d.status}</span>
                  </div>
                  <small>Qty: {d.quantity.amount} {d.quantity.unit} • Category: {d.category}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">Nearby Map</div>
            <div className="card-body">
              <MapView center={center} markers={markers} height={360} />
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
