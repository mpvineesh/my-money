import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import GlobalSearch from './GlobalSearch';
import './Header.css';

export default function Header() {
  const { user, signOutUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
      {location.state?.notice && <div className="form-feedback" role="status">{location.state.notice} <button type="button" onClick={() => navigate(location.pathname + location.search, { replace: true, state: { ...location.state, notice: undefined } })}>Dismiss</button></div>}
      <div className="header-inner">
        <div className="brand"><Link to="/" className="brand-link">
          <span className="logo" aria-hidden>
            <img src="/logo1.png" alt="" className="logo-img" />
          </span>
          <span className="brand-text">My Money</span>
        </Link></div>
        <div className="header-actions">
          <GlobalSearch />
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
              <button className="menu-item menu-item-danger" onClick={signOutUser}>Sign out</button>
            </div>
          )}
        </div>
        </div>
      </div>
    </header>
  );
}
