import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('odms_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrapAuth() {
      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (active) setUser(res.data);
      } catch (err) {
        localStorage.removeItem('odms_token');
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    bootstrapAuth();
    return () => {
      active = false;
    };
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const authToken = res.data?.token;
    const authUser = res.data?.user;

    if (authToken) {
      localStorage.setItem('odms_token', authToken);
      setToken(authToken);
      setUser(authUser);
    }

    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('odms_token');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({
    user,
    token,
    loading,
    login,
    logout,
    setUser,
    setToken,
  }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
