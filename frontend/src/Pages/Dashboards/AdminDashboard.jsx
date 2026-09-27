import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { toast } from 'react-toastify';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ role: '', isApproved: '', isActive: '' });

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data);
    } catch {}
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.role) params.role = filters.role;
      if (filters.isApproved !== '') params.isApproved = filters.isApproved;
      if (filters.isActive !== '') params.isActive = filters.isActive;
      const { data } = await api.get('/admin/users', { params });
      setUsers(data.users || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); fetchUsers(); }, []);

  const approveNGO = async (id) => {
    try {
      await api.put(`/admin/users/${id}/approve`);
      toast.success('NGO approved');
      fetchUsers();
    } catch {}
  };

  const deactivateUser = async (id) => {
    try {
      await api.put(`/admin/users/${id}/deactivate`);
      toast.info('User deactivated');
      fetchUsers();
    } catch {}
  };

  return (
    <div className="container py-4">
      <h3 className="mb-3">Admin Dashboard</h3>

      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header">Platform Stats</div>
            <div className="card-body">
              {!stats && <p className="text-muted">Loading...</p>}
              {stats && (
                <div className="row g-3">
                  <div className="col-6">
                    <div className="p-3 border rounded">
                      <div className="fw-bold">Users</div>
                      <div>Total: {stats.users.total}</div>
                      <div>Donors: {stats.users.donors}</div>
                      <div>Requesters: {stats.users.requesters}</div>
                      <div>NGOs: {stats.users.ngos}</div>
                      <div>Pending NGOs: {stats.users.pendingNGOs}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 border rounded">
                      <div className="fw-bold">Donations</div>
                      <div>Total: {stats.donations.total}</div>
                      <div>Active: {stats.donations.active}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 border rounded">
                      <div className="fw-bold">Requests</div>
                      <div>Total: {stats.requests.total}</div>
                      <div>Active: {stats.requests.active}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 border rounded">
                      <div className="fw-bold">Deliveries</div>
                      <div>Total: {stats.deliveries.total}</div>
                      <div>Completed: {stats.deliveries.completed}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header">Filters</div>
            <div className="card-body">
              <div className="row g-2">
                <div className="col-md-4">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={filters.role} onChange={(e)=>setFilters(f=>({...f, role: e.target.value}))}>
                    <option value="">All</option>
                    <option value="donor">Donor</option>
                    <option value="requester">Requester</option>
                    <option value="ngo">NGO</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Approved</label>
                  <select className="form-select" value={filters.isApproved} onChange={(e)=>setFilters(f=>({...f, isApproved: e.target.value}))}>
                    <option value="">All</option>
                    <option value="true">Approved</option>
                    <option value="false">Pending</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Active</label>
                  <select className="form-select" value={filters.isActive} onChange={(e)=>setFilters(f=>({...f, isActive: e.target.value}))}>
                    <option value="">All</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="col-12">
                  <button className="btn btn-outline-secondary" onClick={fetchUsers} disabled={loading}>Apply</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Users</div>
        <div className="card-body" style={{ maxHeight: 400, overflow: 'auto' }}>
          {users.length === 0 && <p className="text-muted">No users found.</p>}
          {users.map(u => (
            <div key={u._id} className="d-flex justify-content-between align-items-center border rounded p-2 mb-2">
              <div>
                <div className="fw-bold">{u.name} <small className="text-muted">({u.role})</small></div>
                <small>{u.email} • {u.phone}</small>
              </div>
              <div className="d-flex gap-2">
                {u.role === 'ngo' && !u.isApproved && (
                  <button className="btn btn-sm btn-success" onClick={()=>approveNGO(u._id)}>Approve NGO</button>
                )}
                {u.isActive && (
                  <button className="btn btn-sm btn-outline-danger" onClick={()=>deactivateUser(u._id)}>Deactivate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
