import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { LayoutDashboard, Briefcase, Target, PlusCircle, Menu, CreditCard, Wallet, Sparkles, Repeat, BellRing, CalendarRange, CalendarDays, PiggyBank, CandlestickChart, Settings as SettingsIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import './BottomNav.css';

const primary = [
  ['/', 'Home', LayoutDashboard],
  ['/expenses', 'Expenses', Wallet],
  ['/add', 'Add', PlusCircle],
  ['/investments', 'Investments', Briefcase],
];
const more = [
  ['/goals', 'Goals', Target], ['/loans', 'Loans', CreditCard],
  ['/recurring', 'Recurring', Repeat], ['/reminders', 'Reminders', BellRing],
  ['/calendar', 'Calendar', CalendarDays], ['/retirement', 'Retirement', PiggyBank],
  ['/swing-trades', 'Swing Trades', CandlestickChart], ['/insights', 'Spending Insights', Sparkles],
  ['/ai-insights', 'AI Insights', Sparkles], ['/monthly-review', 'Monthly Review', CalendarRange],
  ['/settings', 'Settings', SettingsIcon],
];

export default function BottomNav() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    function dismiss(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
    }
    function escape(event) {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener('click', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  if (!user) return null;
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {primary.map(([to, label, Icon]) => { const ActionIcon = Icon; return (
        <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <ActionIcon size={22} /><span>{label}</span>
        </NavLink>
      ); })}
      <div className="nav-more" ref={ref}>
        <button ref={trigger} type="button" className={`nav-item ${open || more.some(([to]) => pathname.startsWith(to)) ? 'active' : ''}`} aria-expanded={open} aria-controls="more-navigation" onClick={() => setOpen(!open)}>
          <Menu size={22} /><span>More</span>
        </button>
        <div id="more-navigation" className={`more-menu ${open ? 'is-open' : ''}`}>
          {more.map(([to, label, Icon]) => { const ActionIcon = Icon; return (
            <NavLink key={to} to={to} className={({ isActive }) => `more-item ${isActive ? 'active' : ''}`} onClick={() => setOpen(false)}>
              <ActionIcon size={16} /><span>{label}</span>
            </NavLink>
          ); })}
        </div>
      </div>
    </nav>
  );
}
