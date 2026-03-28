import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import {
  LayoutDashboard,
  Briefcase,
  Target,
  PlusCircle,
  Menu,
  CreditCard,
  Wallet,
  Sparkles,
  Repeat,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import './BottomNav.css';

export default function BottomNav() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <LayoutDashboard size={20} />
        <span>Dashboard</span>
      </NavLink>
      <NavLink to="/investments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Briefcase size={20} />
        <span>Investments</span>
      </NavLink>
      <NavLink to="/add" className={({ isActive }) => `nav-item nav-item-add ${isActive ? 'active' : ''}`}>
        <PlusCircle size={24} />
        <span>Add</span>
      </NavLink>
      <NavLink to="/goals" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Target size={20} />
        <span>Goals</span>
      </NavLink>
      <MoreMenu />
    </nav>
  );
}

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  return (
    <div className="nav-more" ref={ref}>
      <button className={`nav-item ${open ? 'active' : ''}`} onClick={() => setOpen((v) => !v)}>
        <Menu size={20} />
        <span>More</span>
      </button>
      {open && (
        <div className="more-menu">
          <button className="more-item" onClick={() => { setOpen(false); navigate('/loans'); }}>
            <CreditCard size={16} style={{ marginRight: 8 }} /> Loans
          </button>
          <button className="more-item" onClick={() => { setOpen(false); navigate('/expenses'); }}>
            <Wallet size={16} style={{ marginRight: 8 }} /> Expenses
          </button>
          <button className="more-item" onClick={() => { setOpen(false); navigate('/recurring'); }}>
            <Repeat size={16} style={{ marginRight: 8 }} /> Recurring
          </button>
          <button className="more-item" onClick={() => { setOpen(false); navigate('/ai-insights'); }}>
            <Sparkles size={16} style={{ marginRight: 8 }} /> AI Insights
          </button>
          <button className="more-item" onClick={() => { setOpen(false); navigate('/settings'); }}>
            <SettingsIcon size={16} style={{ marginRight: 8 }} /> Settings
          </button>
        </div>
      )}
    </div>
  );
}
