import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import DonorDashboard from './pages/dashboards/DonorDashboard';
import RequesterDashboard from './pages/dashboards/RequesterDashboard';
import NGODashboard from './pages/dashboards/NGODashboard';
import AdminDashboard from './pages/dashboards/AdminDashboard';

function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container">
        <Link className="navbar-brand" to="/">FODO</Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item"><Link className="nav-link" to="/login" target="_blank" rel="noopener noreferrer">Login</Link></li>
            <li className="nav-item"><Link className="nav-link" to="/register" target="_blank" rel="noopener noreferrer">Register</Link></li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Navbar />
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/donor" element={
          <ProtectedRoute roles={["donor", "admin"]}>
            <DonorDashboard />
          </ProtectedRoute>
        } />
        <Route path="/requester" element={
          <ProtectedRoute roles={["requester", "admin"]}>
            <RequesterDashboard />
          </ProtectedRoute>
        } />
        <Route path="/ngo" element={
          <ProtectedRoute roles={["ngo", "admin"]}>
            <NGODashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute roles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="*" element={<div className="container py-4"><h3>404 - Page Not Found</h3></div>} />
      </Routes>
    </AuthProvider>
  );
}
