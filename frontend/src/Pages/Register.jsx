import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { autofillUserCoords } from '../utils/geolocate';

export default function Register() {
  const { register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      role: 'requester',
      location: {
        address: '',
        coordinates: { latitude: 0, longitude: 0 }
      }
    }
  });
  const navigate = useNavigate();
  const { login } = useAuth();

  const role = watch('role');

  const onSubmit = async (values) => {
    try {
      // ensure numbers
      values.location.coordinates.latitude = parseFloat(values.location.coordinates.latitude);
      values.location.coordinates.longitude = parseFloat(values.location.coordinates.longitude);
      const { data } = await api.post('/auth/register', values);
      toast.success('Registered successfully');
      login(data.token, data.user);
      
      // Navigate to appropriate dashboard in same tab
      let dashboardUrl = '/requester';
      if (values.role === 'donor') dashboardUrl = '/donor';
      else if (values.role === 'ngo') dashboardUrl = '/ngo';
      
      // Navigate in current tab
      navigate(dashboardUrl);
      reset();
    } catch (e) {
      // handled by interceptor
    }
  };

  return (
    <div className="container py-5 fade-in" style={{ maxWidth: 720 }}>
      <div className="card">
        <div className="card-header text-center">
          <h2 className="mb-0">Join FODO</h2>
          <p className="mb-0 mt-2 opacity-75">Create your account and start making a difference</p>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">
                  <i className="bi bi-person me-2"></i>Name
                </label>
                <input className="form-control" placeholder="Your full name" {...register('name', { required: 'Name is required', minLength: 2 })} />
                {errors.name && <small className="text-danger">{errors.name.message}</small>}
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  <i className="bi bi-person-badge me-2"></i>Role
                </label>
                <select className="form-select" {...register('role', { required: true })}>
                  <option value="donor">Donor</option>
                  <option value="requester">Requester</option>
                  <option value="ngo">NGO</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  <i className="bi bi-envelope me-2"></i>Email
                </label>
                <input type="email" className="form-control" placeholder="you@example.com" {...register('email', { required: 'Email is required' })} />
                {errors.email && <small className="text-danger">{errors.email.message}</small>}
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  <i className="bi bi-telephone me-2"></i>Phone
                </label>
                <input className="form-control" placeholder="10-digit number"
                  {...register('phone', { required: 'Phone is required', pattern: { value: /^[6-9]\d{9}$/, message: 'Invalid phone' } })} />
                {errors.phone && <small className="text-danger">{errors.phone.message}</small>}
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  <i className="bi bi-lock me-2"></i>Password
                </label>
                <input type="password" className="form-control" placeholder="Minimum 6 characters" {...register('password', { required: 'Password is required', minLength: 6 })} />
                {errors.password && <small className="text-danger">{errors.password.message}</small>}
              </div>

              {role === 'donor' && (
                <div className="col-md-6">
                  <label className="form-label">
                    <i className="bi bi-building me-2"></i>Business Type
                  </label>
                  <select className="form-select" {...register('businessType', { required: 'Business type is required' })}>
                    <option value="restaurant">Restaurant</option>
                    <option value="hotel">Hotel</option>
                    <option value="grocery_store">Grocery Store</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.businessType && <small className="text-danger">{errors.businessType.message}</small>}
                </div>
              )}

              {role === 'ngo' && (
                <>
                  <div className="col-md-6">
                    <label className="form-label">
                      <i className="bi bi-building me-2"></i>Organization Name
                    </label>
                    <input className="form-control" placeholder="Your organization name" {...register('organizationName', { required: 'Organization name is required' })} />
                    {errors.organizationName && <small className="text-danger">{errors.organizationName.message}</small>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">
                      <i className="bi bi-file-text me-2"></i>Registration Number
                    </label>
                    <input className="form-control" placeholder="Registration number" {...register('registrationNumber', { required: 'Registration number is required' })} />
                    {errors.registrationNumber && <small className="text-danger">{errors.registrationNumber.message}</small>}
                  </div>
                </>
              )}

              <div className="col-12">
                <label className="form-label">
                  <i className="bi bi-geo-alt me-2"></i>Address
                </label>
                <input className="form-control" placeholder="Your complete address" {...register('location.address', { required: 'Address is required' })} />
                {errors.location?.address && <small className="text-danger">{errors.location.address.message}</small>}
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  <i className="bi bi-geo me-2"></i>Latitude
                </label>
                <input className="form-control" type="number" step="any" placeholder="e.g., 28.6139" {...register('location.coordinates.latitude', { required: 'Latitude is required' })} />
                {errors.location?.coordinates?.latitude && <small className="text-danger">{errors.location.coordinates.latitude.message}</small>}
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  <i className="bi bi-geo me-2"></i>Longitude
                </label>
                <input className="form-control" type="number" step="any" placeholder="e.g., 77.2090" {...register('location.coordinates.longitude', { required: 'Longitude is required' })} />
                {errors.location?.coordinates?.longitude && <small className="text-danger">{errors.location.coordinates.longitude.message}</small>}
              </div>

              <div className="col-12">
                <button type="button" className="btn btn-outline-secondary" onClick={async()=>{
                  try {
                    const { latitude, longitude } = await autofillUserCoords(setValue);
                    toast.info(`GPS set to ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                  } catch (e) {
                    toast.error('Unable to get GPS location');
                  }
                }}>
                  <i className="bi bi-geo-alt me-2"></i>Use GPS Location
                </button>
              </div>

              <div className="col-12">
                <button className="btn btn-success w-100 mb-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-person-plus me-2"></i>
                      Create Account
                    </>
                  )}
                </button>
                <div className="text-center">
                  <span className="text-muted">Already have an account? </span>
                  <Link to="/login" className="text-decoration-none fw-semibold" target="_blank" rel="noopener noreferrer">
                    Sign in here
                  </Link>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
