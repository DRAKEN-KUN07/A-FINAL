import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('gatepass_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [visitorProfile, setVisitorProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('gatepass_token')));
  const [selectedOrgId, setSelectedOrgId] = useState('all');

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem('gatepass_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setVisitorProfile(res.data.visitor || null);
      localStorage.setItem('gatepass_user', JSON.stringify(res.data.user));
    } catch {
      localStorage.removeItem('gatepass_token');
      localStorage.removeItem('gatepass_user');
      setUser(null);
      setVisitorProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('gatepass_token', res.data.token);
    localStorage.setItem('gatepass_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    await refreshMe();
    return res.data.user;
  };

  const register = async (payload) => {
    const res = await api.post('/auth/register', payload);
    localStorage.setItem('gatepass_token', res.data.token);
    localStorage.setItem('gatepass_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    setVisitorProfile(res.data.visitor || null);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('gatepass_token');
    localStorage.removeItem('gatepass_user');
    setUser(null);
    setVisitorProfile(null);
    setSelectedOrgId('all');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        visitorProfile,
        loading,
        selectedOrgId,
        setSelectedOrgId,
        login,
        register,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
