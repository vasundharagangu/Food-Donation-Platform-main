import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: '', password: '' }
  });
  const { login } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (values) => {
    try {
      const payload = {
        email: (values.email || '').trim(),
        password: values.password || ''
      };
      if (!payload.email || !payload.password) {
        toast.error('Please enter email and password');
        return;
      }
      const { data } = await api.post('/auth/login', payload);
      login(data.token, data.user);
      toast.success('Logged in successfully');
      const role = data.user.role;
      
      // Navigate to appropriate dashboard in same tab
      let dashboardUrl = '/';
      if (role === 'donor') dashboardUrl = '/donor';
      else if (role === 'requester') dashboardUrl = '/requester';
      else if (role === 'ngo') dashboardUrl = '/ngo';
      else if (role === 'admin') dashboardUrl = '/admin';
      
      // Navigate in current tab
      navigate(dashboardUrl);
    } catch (e) {
      const resp = e?.response?.data;
      if (resp?.errors && Array.isArray(resp.errors)) {
        resp.errors.forEach(er => toast.error(er.msg || 'Validation failed'));
      } else if (resp?.message) {
        toast.error(resp.message);
      } else {
        toast.error('Login failed');
      }
    }
  };

  return (
    <div className="container py-5 fade-in" style={{ maxWidth: 520 }}>
      <div className="card">
        <div className="card-header text-center">
          <h2 className="mb-0">Welcome Back</h2>
          <p className="mb-0 mt-2 opacity-75">Sign in to your FODO account</p>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-3">
              <label className="form-label">
                <i className="bi bi-envelope me-2"></i>Email
              </label>
              <input type="email" className="form-control" placeholder="you@example.com"
                {...register('email', { required: 'Email is required' })} />
              {errors.email && <small className="text-danger">{errors.email.message}</small>}
            </div>
            <div className="mb-4">
              <label className="form-label">
                <i className="bi bi-lock me-2"></i>Password
              </label>
              <input type="password" className="form-control" placeholder="••••••••"
                {...register('password', { required: 'Password is required' })} />
              {errors.password && <small className="text-danger">{errors.password.message}</small>}
            </div>
            <button className="btn btn-primary w-100 mb-3" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Logging in...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right me-2"></i>
                  Login
                </>
              )}
            </button>
          </form>
          <div className="text-center">
            <span className="text-muted">New here? </span>
            <Link to="/register" className="text-decoration-none fw-semibold" target="_blank" rel="noopener noreferrer">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
