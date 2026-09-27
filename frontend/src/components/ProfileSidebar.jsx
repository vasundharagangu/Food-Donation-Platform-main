import React from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function ProfileSidebar() {
  const { user, setUser } = useAuth();
  if (!user) return null;

  return (
    <div className="card h-100">
      <div className="card-body">
        <div className="d-flex align-items-center mb-3">
          <img
            alt="avatar"
            src={user.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || 'U')}`}
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }}
          />
          <div className="ms-3">
            <div className="fw-bold mb-1">{user.name}</div>
            <span className="badge bg-secondary text-uppercase">{user.role}</span>
          </div>
        </div>

        <div className="mb-3">
          <div className="small text-muted">Location</div>
          <div>{user.location?.address || '—'}</div>
          {user.location?.coordinates && (
            <div className="text-muted small">{user.location.coordinates.latitude}, {user.location.coordinates.longitude}</div>
          )}
        </div>

        <hr />

        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="small text-muted">Profile</div>
          <button className="btn btn-sm btn-outline-secondary"
                  onClick={async ()=>{
                    try {
                      const me = await api.get('/auth/me');
                      setUser(me.data.user);
                    } catch {}
                  }}>Refresh</button>
        </div>

        <div className="row g-2 text-center">
          <div className="col-6">
            <div className="border rounded p-2">
              <div className="small text-muted">Points</div>
              <div className="fs-5 fw-semibold">{user.points ?? 0}</div>
            </div>
          </div>
          {user.role === 'donor' && (
            <div className="col-6">
              <div className="border rounded p-2">
                <div className="small text-muted">Donations</div>
                <div className="fs-5 fw-semibold">{user.totalDonations ?? 0}</div>
              </div>
            </div>
          )}
          {user.role === 'requester' && (
            <div className="col-6">
              <div className="border rounded p-2">
                <div className="small text-muted">Received</div>
                <div className="fs-5 fw-semibold">{user.totalRequests ?? 0}</div>
              </div>
            </div>
          )}
          {user.role === 'ngo' && (
            <div className="col-6">
              <div className="border rounded p-2">
                <div className="small text-muted">Deliveries</div>
                <div className="fs-5 fw-semibold">{user.totalDeliveries ?? 0}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
