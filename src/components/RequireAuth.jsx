import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function RequireAuth({ children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <div className="app-loading" role="status">Loading your money overview…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
