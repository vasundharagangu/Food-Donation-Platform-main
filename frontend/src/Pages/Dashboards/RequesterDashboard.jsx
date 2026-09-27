import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { initSocket } from '../../utils/socket';
import MapView from '../../components/MapView';
import ProfileSidebar from '../../components/ProfileSidebar';
import { autofillUserCoords } from '../../utils/geolocate';

export default function RequesterDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [foodTypesText, setFoodTypesText] = useState('');

  const { register, handleSubmit, reset, setValue, formState: { isSubmitting, errors } } = useForm({
    defaultValues: {
      title: '',
      description: '',
      location: {
        address: user?.location?.address || '',
        coordinates: {
          latitude: user?.location?.coordinates?.latitude || 0,
          longitude: user?.location?.coordinates?.longitude || 0,
        },
        instructions: ''
      },
      requirements: {
        quantity: { amount: 1, unit: 'plates' },
        categories: ['cooked_food'],
        isVegetarianOnly: false,
        isVeganOnly: false,
        allergiesToAvoid: []
      },
      urgency: 'medium',
      numberOfPeople: 1
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

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/requests');
      setRequests(data.requests || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(); }, []);

  const onCreate = async (values) => {
    try {
      // Build payload with proper types
      const payload = {
        title: values.title,
        description: values.description,
        location: {
          address: values.location.address,
          coordinates: {
            latitude: parseFloat(values.location.coordinates.latitude),
            longitude: parseFloat(values.location.coordinates.longitude),
          },
          instructions: values.location.instructions || ''
        },
        requirements: {
          // Parse comma separated list into array of strings
          foodTypes: foodTypesText
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
          quantity: {
            amount: parseFloat(values.requirements.quantity.amount),
            unit: values.requirements.quantity.unit,
          },
          categories: values.requirements.categories,
          isVegetarianOnly: !!values.requirements.isVegetarianOnly,
          isVeganOnly: !!values.requirements.isVeganOnly,
          allergiesToAvoid: values.requirements.allergiesToAvoid || [],
        },
        urgency: values.urgency,
        numberOfPeople: parseInt(values.numberOfPeople, 10),
      };

      if (!payload.requirements.foodTypes.length) {
        payload.requirements.foodTypes = ['cooked_food'];
      }

      const { data } = await api.post('/requests', payload);
      toast.success('Request posted');
      reset();
      setRequests(prev => [data.request, ...prev]);
    } catch (e) {
      // Show server validation errors if present
      const resp = e?.response?.data;
      if (resp?.errors && Array.isArray(resp.errors)) {
        resp.errors.forEach((er) => toast.error(er.msg || er.message || 'Validation failed'));
      } else if (resp?.message) {
        toast.error(resp.message);
      } else {
        toast.error('Failed to create request');
      }
    }
  };

  const markers = useMemo(() => {
    return requests.filter(r => r.location?.coordinates).map(r => ({
      lat: r.location.coordinates.latitude,
      lng: r.location.coordinates.longitude,
      color: r.status === 'pending' ? 'yellow' : (r.status === 'expired' ? 'red' : 'blue'),
      popup: `<strong>${r.title}</strong><br/>Urgency: ${r.urgency}<br/>Status: ${r.status}`
    }));
  }, [requests]);

  return (
    <div className="container py-4 fade-in">
      <div className="d-flex align-items-center mb-4">
        <div className="me-3">
          <div className="bg-warning rounded-circle d-flex align-items-center justify-content-center" style={{width: '60px', height: '60px'}}>
            <i className="bi bi-hand-thumbs-up-fill text-white fs-4"></i>
          </div>
        </div>
        <div>
          <h3 className="mb-1">Requester Dashboard</h3>
          <p className="text-muted mb-0">Request food assistance when you need it</p>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-3">
          <ProfileSidebar />
        </div>
        <div className="col-lg-9">
          <div className="card mb-4">
            <div className="card-header">Request Food</div>
            <div className="card-body">
              <form onSubmit={handleSubmit(onCreate)} className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Title</label>
                  <input className="form-control" {...register('title', { required: 'Title is required', minLength: { value: 5, message: 'Min 5 characters' } })} />
                  {errors.title && <small className="text-danger">{errors.title.message}</small>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Urgency</label>
                  <select className="form-select" {...register('urgency', { required: true })}>
                    <option>low</option>
                    <option>medium</option>
                    <option>high</option>
                    <option>critical</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={2} {...register('description', { required: 'Description is required', minLength: { value: 10, message: 'Min 10 characters' } })} />
                  {errors.description && <small className="text-danger">{errors.description.message}</small>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Address</label>
                  <input className="form-control" {...register('location.address', { required: true })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Lat</label>
                  <input className="form-control" type="number" step="any" {...register('location.coordinates.latitude', { required: true })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Lng</label>
                  <input className="form-control" type="number" step="any" {...register('location.coordinates.longitude', { required: true })} />
                </div>
                <div className="col-12">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={async()=>{
                    try {
                      const { latitude, longitude } = await autofillUserCoords(setValue);
                      toast.info(`GPS set to ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                    } catch (e) {
                      toast.error('Unable to get GPS location');
                    }
                  }}>Use GPS</button>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Food Types (comma separated)</label>
                  <input
                    className="form-control"
                    value={foodTypesText}
                    onChange={(e) => setFoodTypesText(e.target.value)}
                    placeholder="e.g. cooked_food, bakery"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Qty</label>
                  <input className="form-control" type="number" step="any" {...register('requirements.quantity.amount', { required: true, min: 1 })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Unit</label>
                  <select className="form-select" {...register('requirements.quantity.unit', { required: true })}>
                    <option>plates</option>
                    <option>pieces</option>
                    <option>kg</option>
                    <option>boxes</option>
                    <option>liters</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">People</label>
                  <input className="form-control" type="number" {...register('numberOfPeople', { required: 'Required', min: { value: 1, message: 'Min 1' }, max: { value: 100, message: 'Max 100' } })} />
                  {errors.numberOfPeople && <small className="text-danger">{errors.numberOfPeople.message}</small>}
                </div>
                <div className="col-12">
                  <button className="btn btn-warning" disabled={isSubmitting}>{isSubmitting ? 'Posting...' : 'Post Request'}</button>
                </div>
              </form>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">Rate a Completed Delivery</div>
            <div className="card-body">
              <RatingForm />
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <span>Your Requests</span>
                  <button className="btn btn-sm btn-outline-secondary" onClick={fetchRequests} disabled={loading}>Refresh</button>
                </div>
                <div className="card-body" style={{ maxHeight: 400, overflow: 'auto' }}>
                  {requests.length === 0 && <p className="text-muted">No requests yet.</p>}
                  {requests.map(r => (
                    <div className="border rounded p-2 mb-2" key={r._id}>
                      <div className="d-flex justify-content-between">
                        <strong>{r.title}</strong>
                        <span className={`badge bg-${r.status === 'pending' ? 'warning' : r.status === 'expired' ? 'danger' : 'secondary'}`}>{r.status}</span>
                      </div>
                      <small>Urgency: {r.urgency} • People: {r.numberOfPeople}</small>
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

function RatingForm() {
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({ defaultValues: { deliveryId: '', donorRating: 5, ngoRating: 5, donorFeedback: '', ngoFeedback: '' } });
  const { setUser } = useAuth();
  const [delivered, setDelivered] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const loadDelivered = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/deliveries', { params: { status: 'delivered', limit: 20 } });
      setDelivered(data.deliveries || []);
    } catch {}
    finally { setLoading(false); }
  };

  React.useEffect(() => { loadDelivered(); }, []);

  const onSubmit = async (values) => {
    try {
      const payload = {};
      if (values.donorRating) payload.donorRating = Number(values.donorRating);
      if (values.ngoRating) payload.ngoRating = Number(values.ngoRating);
      if (values.donorFeedback) payload.donorFeedback = values.donorFeedback;
      if (values.ngoFeedback) payload.ngoFeedback = values.ngoFeedback;
      await api.post(`/ratings/delivery/${values.deliveryId}`, payload);
      toast.success('Thanks for your feedback!');
      reset();
      // Refresh profile points after rating bonus
      try {
        const me = await api.get('/auth/me');
        setUser(me.data.user);
      } catch {}
    } catch (e) {
      const resp = e?.response?.data;
      if (resp?.errors && Array.isArray(resp.errors)) {
        resp.errors.forEach(er => toast.error(er.msg || 'Validation failed'));
      } else if (resp?.message) {
        toast.error(resp.message);
      } else {
        toast.error('Failed to submit ratings');
      }
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="row g-3">
      <div className="col-md-6">
        <label className="form-label">Delivered Orders</label>
        <select className="form-select" disabled={loading || delivered.length === 0} {...register('deliveryId', { required: true })}>
          <option value="">{loading ? 'Loading...' : (delivered.length === 0 ? 'No delivered orders' : 'Select a delivery')}</option>
          {delivered.map(d => (
            <option key={d._id} value={d._id}>{d.request?.title || d.donation?.foodType || 'Delivery'} — {d._id.slice(-6)}</option>
          ))}
        </select>
      </div>
      <div className="col-md-4">
        <label className="form-label">Donor Rating</label>
        <select className="form-select" {...register('donorRating')}>{[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}</option>)}</select>
      </div>
      <div className="col-md-4">
        <label className="form-label">NGO Rating</label>
        <select className="form-select" {...register('ngoRating')}>{[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}</option>)}</select>
      </div>
      <div className="col-md-6">
        <label className="form-label">Donor Feedback</label>
        <input className="form-control" {...register('donorFeedback')} />
      </div>
      <div className="col-md-6">
        <label className="form-label">NGO Feedback</label>
        <input className="form-control" {...register('ngoFeedback')} />
      </div>
      <div className="col-12">
        <button className="btn btn-success" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Ratings'}</button>
      </div>
    </form>
  );
}
