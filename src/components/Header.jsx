import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Header.css';

export default function Header() {
  const { user, signOutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  if (!user) return null;

  const initials = (user.displayName || user.email || 'U').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand"><Link to="/" className="brand-link">
          <span className="logo" aria-hidden>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="24" height="24" rx="6" fill="url(#g)" />
              <defs>
                <linearGradient id="g" x1="0" x2="1">
                  <stop offset="0" stopColor="#7c3aed" />
                  <stop offset="1" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
              <path d="M6 13c1.2-2 3.5-3 6-3s4.8 1 6 3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
              <circle cx="8" cy="9" r="1.2" fill="white" opacity="0.95" />
            </svg>
          </span>
          <span className="brand-text">My Money</span>
        </Link></div>
        <div className="profile" ref={ref}>
          <button className="profile-btn" onClick={() => setOpen(v => !v)} aria-haspopup>
            <span className="avatar">{initials}</span>
          </button>
          {open && (
            <div className="profile-menu">
              <div className="profile-info">
                <div className="avatar avatar-lg">{initials}</div>
                <div className="profile-meta">
                  <div className="name">{user.displayName || user.email}</div>
                  <div className="email">{user.email}</div>
                </div>
              </div>
              <button className="menu-item" onClick={signOutUser}>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
