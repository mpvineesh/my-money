import { useEffect, useState } from 'react';
import './SplashScreen.css';

export default function SplashScreen() {
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setHidden(true), 1800);
    const removeTimer = setTimeout(() => setRemoved(true), 2300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (removed) return null;

  return (
    <div className={`splash-screen${hidden ? ' splash-screen--hidden' : ''}`}>
      <img src="/splash.png" alt="My Money" className="splash-screen__image" />
    </div>
  );
}
