import React, { useEffect } from 'react';
import './Login.css';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { user, signInWithGoogle, signOutUser, loading, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-brand">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#4F46E5" />
            <path d="M7 12h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 8h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          </svg>
          <h1>My Money</h1>
        </div>

        <p className="login-sub">Securely save and track your investments and goals.</p>

        {user ? (
          <div className="login-actions">
            <p className="muted">Signed in as <strong>{user.displayName || user.email}</strong></p>
            <button className="btn btn-ghost" onClick={signOutUser}>Sign out</button>
          </div>
        ) : (
          <div className="login-actions">
            <button className="btn btn-google" onClick={signInWithGoogle} disabled={loading}>
              <span className="google-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.9 0 7 1.4 9.2 3.2l6.8-6.8C35.8 2.9 30.2 1 24 1 14.8 1 6.9 6.3 3 13.8l7.9 6.1C12.3 13.5 17.6 9.5 24 9.5z"/>
                  <path fill="#34A853" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.6H24v9.2h12.8c-.6 3.6-3.2 6.6-6.8 8.4l7.9 6.1C43.7 38.1 46.5 31.9 46.5 24.5z"/>
                  <path fill="#4A90E2" d="M10.9 29.9A14.6 14.6 0 0 1 9.5 24.5c0-1.6.3-3.1.8-4.4L2.4 13.9C-0.3 17.9 0 23 1.9 27.1l9 2.8z"/>
                  <path fill="#FBBC05" d="M24 46c6.2 0 11.8-2 15.8-5.4l-7.9-6.1C31 35.9 27.9 37 24 37c-6.4 0-11.7-4-13.1-9.8l-9 6.1C6.9 41.7 14.8 46 24 46z"/>
                </svg>
              </span>
              <span className="btn-text">Sign in with Google</span>
              {loading && <span className="spinner" />}
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
