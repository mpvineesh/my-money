import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Briefcase,
  Target,
  PlusCircle,
} from 'lucide-react';
import { CreditCard } from 'lucide-react';
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
      <NavLink to="/loans" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <CreditCard size={20} />
        <span>Loans</span>
      </NavLink>
      <NavLink to="/add" className={({ isActive }) => `nav-item nav-item-add ${isActive ? 'active' : ''}`}>
        <PlusCircle size={24} />
        <span>Add</span>
      </NavLink>
      <NavLink to="/goals" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Target size={20} />
        <span>Goals</span>
      </NavLink>
    </nav>
  );
}
