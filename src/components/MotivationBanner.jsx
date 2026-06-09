import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { formatCurrency } from '../utils/constants';
import './MotivationBanner.css';

const DISMISS_KEY = 'myMoney_home_banner_dismissed';

const QUOTES = [
  { emoji: '✨', title: 'Spend less than you earn; invest the difference.', subtitle: 'The simplest path to wealth.' },
  { emoji: '🌱', title: 'Small steps today, big wealth tomorrow.', subtitle: 'Consistency beats timing.' },
  { emoji: '📚', title: 'An investment in knowledge pays the best interest.', subtitle: '— Benjamin Franklin' },
  { emoji: '💡', title: 'Do not save what is left after spending; spend what is left after saving.', subtitle: '— Warren Buffett' },
  { emoji: '🌳', title: 'The best time to start was years ago. The second best time is today.', subtitle: 'Begin where you are.' },
  { emoji: '🧭', title: 'Patience and consistency build portfolios, not luck.', subtitle: 'Stay the course.' },
  { emoji: '💪', title: 'Every rupee saved today is a rupee working for your future.', subtitle: 'Keep it up.' },
];

function getToday() {
  const now = new Date();
  const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}

// Stable day-of-year-ish seed so the message is consistent through the day but rotates daily.
function getDaySeed() {
  const today = getToday(); // YYYY-MM-DD
  const [y, m, d] = today.split('-').map(Number);
  return (y || 0) * 372 + (m || 0) * 31 + (d || 0);
}

// Build the list of true, encouraging facts from the user's data. Returns [] when there's nothing
// positive to say yet, in which case the caller falls back to a quote.
function buildDataBanners({ stats, goals, netWorthChange, netWorthRange }) {
  const banners = [];
  const periodWord = netWorthRange === 'year' ? 'year' : 'month';

  if (netWorthChange > 0) {
    banners.push({
      emoji: '📈',
      title: `You're up ${formatCurrency(netWorthChange)} this ${periodWord}`,
      subtitle: 'Net worth climbing — keep it going!',
    });
  }

  if (stats?.totalGain > 0 && stats?.totalInvested > 0) {
    banners.push({
      emoji: '💰',
      title: `Portfolio up ${stats.overallReturn}% overall`,
      subtitle: `That's ${formatCurrency(stats.totalGain)} in gains so far.`,
    });
  }

  // Goal milestones: celebrate any reached goal, else cheer on the closest in-progress goal.
  const goalProgress = (goals || [])
    .map((goal) => {
      const target = Number(goal.targetAmount) || 0;
      const current = Number(goal.currentAmount) || 0;
      return { name: goal.name || goal.title || 'your goal', pct: target > 0 ? (current / target) * 100 : 0 };
    })
    .filter((goal) => goal.pct > 0);

  const reached = goalProgress.find((goal) => goal.pct >= 100);
  if (reached) {
    banners.push({
      emoji: '🎉',
      title: `You reached your ${reached.name} goal!`,
      subtitle: 'Time to set the next one.',
    });
  } else {
    const closest = goalProgress.sort((a, b) => b.pct - a.pct)[0];
    if (closest) {
      banners.push({
        emoji: '🎯',
        title: `${Math.round(closest.pct)}% toward ${closest.name}`,
        subtitle: closest.pct >= 75 ? 'Almost there — finish strong!' : 'Steady progress. Keep saving!',
      });
    }
  }

  if (!banners.length && stats?.netWorth > 0) {
    banners.push({
      emoji: '🌱',
      title: `Net worth ${formatCurrency(stats.netWorth)} and growing`,
      subtitle: 'Every contribution compounds.',
    });
  }

  return banners;
}

export default function MotivationBanner({ stats, goals, netWorthChange, netWorthRange }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === getToday();
    } catch {
      return false;
    }
  });

  const banner = useMemo(() => {
    const dataBanners = buildDataBanners({ stats, goals, netWorthChange, netWorthRange });
    const pool = dataBanners.length ? dataBanners : QUOTES;
    return pool[getDaySeed() % pool.length];
  }, [stats, goals, netWorthChange, netWorthRange]);

  if (dismissed || !banner) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, getToday());
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <section className="motiv-banner" role="status">
      <span className="motiv-emoji" aria-hidden="true">{banner.emoji}</span>
      <div className="motiv-text">
        <strong className="motiv-title">{banner.title}</strong>
        {banner.subtitle ? <span className="motiv-subtitle">{banner.subtitle}</span> : null}
      </div>
      <button type="button" className="motiv-dismiss" onClick={handleDismiss} aria-label="Dismiss for today">
        <X size={16} />
      </button>
    </section>
  );
}
