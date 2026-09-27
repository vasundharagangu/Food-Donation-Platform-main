import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import jwtDecode from 'jwt-decode';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ww_token'));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('ww_user');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (token) localStorage.setItem('ww_token', token); else localStorage.removeItem('ww_token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('ww_user', JSON.stringify(user)); else localStorage.removeItem('ww_user');
  }, [user]);

  const isAuthed = Boolean(token && user);
  const role = user?.role || null;

  const login = (jwt, userObj) => {
    try {
      const decoded = jwtDecode(jwt);
      if (!decoded?.exp || decoded.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
      }
      setToken(jwt);
      setUser(userObj);
    } catch (e) {
      console.error('Invalid token', e);
      logout();
    }
  };

  // Check token validity on app load
  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded?.exp && decoded.exp * 1000 < Date.now()) {
          // Token expired, clear it
          console.log('Token expired, logging out');
          logout();
        } else {
          console.log('Token is valid, user should stay logged in');
          // Verify user is still active by checking with backend
          const verifyUser = async () => {
            try {
              const response = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:3000/api'}/auth/me`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              if (!response.ok) {
                console.log('User verification failed, logging out');
                logout();
              }
            } catch (e) {
              console.log('User verification error, logging out:', e.message);
              logout();
            }
          };
          verifyUser();
        }
      } catch (e) {
        // Invalid token, clear it
        console.log('Invalid token, logging out:', e.message);
        logout();
      }
    } else {
      console.log('No token found');
    }
  }, [token]);

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ token, user, role, isAuthed, login, logout, setUser }), [token, user, role, isAuthed]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
