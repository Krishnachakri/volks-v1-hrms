import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AuthUser {
  userId: string;
  personId: string;
  name: string;
  email: string;
  role: string;
  roles: string[];
}

export interface AuthPerson {
  person_id: string;
  full_name: string;
  personal_email: string;
  phone?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  person: AuthPerson | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [person, setPerson] = useState<AuthPerson | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('volks_auth_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    bootstrapAuth();
  }, []);

  const bootstrapAuth = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const savedToken = localStorage.getItem('volks_auth_token');
      if (savedToken) {
        headers['Authorization'] = `Bearer ${savedToken}`;
      }

      const res = await fetch('http://localhost:4000/api/auth/me', {
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setPerson(data.person);
      } else {
        // Session expired or unauthenticated
        setUser(null);
        setPerson(null);
        localStorage.removeItem('volks_auth_token');
        setToken(null);
      }
    } catch (err) {
      setUser(null);
      setPerson(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Authentication failed' };
      }

      setToken(data.token);
      localStorage.setItem('volks_auth_token', data.token);
      setUser(data.user);
      
      // Fetch full profile via /me
      await bootstrapAuth();

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during login.' };
    }
  };

  const logout = async () => {
    try {
      const savedToken = localStorage.getItem('volks_auth_token');
      const headers: Record<string, string> = {};
      if (savedToken) {
        headers['Authorization'] = `Bearer ${savedToken}`;
      }

      await fetch('http://localhost:4000/api/auth/logout', {
        method: 'POST',
        headers,
      });
    } catch (e) {
      // Ignore logout network error
    } finally {
      setUser(null);
      setPerson(null);
      setToken(null);
      localStorage.removeItem('volks_auth_token');
    }
  };

  return (
    <AuthContext.Provider value={{ user, person, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
