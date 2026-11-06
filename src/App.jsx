import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import BottomNav from './components/BottomNav';
import Header from './components/Header';
import ScrollToTop from './components/ScrollToTop';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Investments = lazy(() => import('./pages/Investments'));
const InvestmentForm = lazy(() => import('./pages/InvestmentForm'));
const InvestmentTransactions = lazy(() => import('./pages/InvestmentTransactions'));
const SwingTrades = lazy(() => import('./pages/SwingTrades'));
const SwingTradeForm = lazy(() => import('./pages/SwingTradeForm'));
const Goals = lazy(() => import('./pages/Goals'));
const GoalForm = lazy(() => import('./pages/GoalForm'));
const Loans = lazy(() => import('./pages/Loans'));
const LoanForm = lazy(() => import('./pages/LoanForm'));
const AddPage = lazy(() => import('./pages/AddPage'));
const Login = lazy(() => import('./pages/Login'));
import RequireAuth from './components/RequireAuth';
import LockGate from './components/LockGate';
const Expenses = lazy(() => import('./pages/Expenses'));
const ExpenseList = lazy(() => import('./pages/ExpenseList'));
const ExpenseForm = lazy(() => import('./pages/ExpenseForm'));
const ExpenseScan = lazy(() => import('./pages/ExpenseScan'));
const AiInsights = lazy(() => import('./pages/AiInsights'));
const MonthlyReview = lazy(() => import('./pages/MonthlyReview'));
const Recurring = lazy(() => import('./pages/Recurring'));
const RecurringForm = lazy(() => import('./pages/RecurringForm'));
const Reminders = lazy(() => import('./pages/Reminders'));
const Settings = lazy(() => import('./pages/Settings'));
const FamilyMembers = lazy(() => import('./pages/FamilyMembers'));
const Vault = lazy(() => import('./pages/Vault'));
const Insights = lazy(() => import('./pages/Insights'));
const MutualFunds = lazy(() => import('./pages/MutualFunds'));
const Stocks = lazy(() => import('./pages/Stocks'));
const Retirement = lazy(() => import('./pages/Retirement'));
const Calendar = lazy(() => import('./pages/Calendar'));
import { VaultProvider } from './context/VaultContext';
import { FEATURES } from './config';
import { useAuth } from './context/useAuth';
import SplashScreen from './components/SplashScreen';
import './App.css';
// Shared button, tooltip, and form styles are also used on directly opened routes.
import './pages/Dashboard.css';
import './pages/InvestmentForm.css';
const GoalDetail = lazy(() => import('./pages/GoalDetail'));

// Remount the data provider whenever the active household changes (sign-in, sign-out,
// or a member resolving to their owner's household) so no in-memory state from the
// previous account survives into the next one.
function HouseholdScopedAppProvider({ children }) {
  const { user, household } = useAuth();
  const scopeKey = household?.mode === 'member' ? household.ownerUid : user?.uid;
  return <AppProvider key={scopeKey || 'signed-out'}>{children}</AppProvider>;
}

export default function App() {
  return (
    <BrowserRouter>
      <SplashScreen />
      <AuthProvider>
        <LockGate>
        <HouseholdScopedAppProvider>
          <VaultProvider>
          <ScrollToTop />
          <div className="app-container">
            <Header />
            <main className="app-main">
              <Suspense fallback={<div className="app-loading" role="status">Loading…</div>}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
                <Route path="/investments" element={<RequireAuth><Investments /></RequireAuth>} />
                <Route path="/mutual-funds" element={<RequireAuth><MutualFunds /></RequireAuth>} />
                <Route path="/stocks" element={<RequireAuth><Stocks /></RequireAuth>} />
                <Route path="/investments/transactions" element={<RequireAuth><InvestmentTransactions /></RequireAuth>} />
                <Route path="/investments/new" element={<RequireAuth><InvestmentForm /></RequireAuth>} />
                <Route path="/investments/edit/:id" element={<RequireAuth><InvestmentForm /></RequireAuth>} />
                <Route path="/swing-trades" element={<RequireAuth><SwingTrades /></RequireAuth>} />
                <Route path="/swing-trades/new" element={<RequireAuth><SwingTradeForm /></RequireAuth>} />
                <Route path="/swing-trades/edit/:id" element={<RequireAuth><SwingTradeForm /></RequireAuth>} />
                <Route path="/add" element={<RequireAuth><AddPage /></RequireAuth>} />
                <Route path="/loans" element={<RequireAuth><Loans /></RequireAuth>} />
                <Route path="/loans/new" element={<RequireAuth><LoanForm /></RequireAuth>} />
                <Route path="/loans/edit/:id" element={<RequireAuth><LoanForm /></RequireAuth>} />
                <Route path="/goals" element={<RequireAuth><Goals /></RequireAuth>} />
                <Route path="/goals/:id" element={<RequireAuth><GoalDetail /></RequireAuth>} />
                <Route path="/goals/add" element={<RequireAuth><GoalForm /></RequireAuth>} />
                <Route path="/goals/edit/:id" element={<RequireAuth><GoalForm /></RequireAuth>} />
                <Route path="/expenses" element={<RequireAuth><Expenses /></RequireAuth>} />
                <Route path="/expenses/list" element={<RequireAuth><ExpenseList /></RequireAuth>} />
                <Route path="/expenses/new" element={<RequireAuth><ExpenseForm /></RequireAuth>} />
                <Route path="/expenses/scan" element={<RequireAuth><ExpenseScan /></RequireAuth>} />
                <Route path="/expenses/edit/:id" element={<RequireAuth><ExpenseForm /></RequireAuth>} />
                <Route path="/recurring" element={<RequireAuth><Recurring /></RequireAuth>} />
                <Route path="/recurring/new" element={<RequireAuth><RecurringForm /></RequireAuth>} />
                <Route path="/recurring/edit/:id" element={<RequireAuth><RecurringForm /></RequireAuth>} />
                <Route path="/reminders" element={<RequireAuth><Reminders /></RequireAuth>} />
                <Route path="/ai-insights" element={<RequireAuth><AiInsights /></RequireAuth>} />
                <Route path="/monthly-review" element={<RequireAuth><MonthlyReview /></RequireAuth>} />
                <Route path="/insights" element={<RequireAuth><Insights /></RequireAuth>} />
                <Route path="/retirement" element={<RequireAuth><Retirement /></RequireAuth>} />
                <Route path="/calendar" element={<RequireAuth><Calendar /></RequireAuth>} />
                <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
                <Route path="/family-members" element={<RequireAuth><FamilyMembers /></RequireAuth>} />
                {FEATURES.passwordVault ? (
                  <Route path="/vault" element={<RequireAuth><Vault /></RequireAuth>} />
                ) : null}
                <Route path="*" element={<div className="app-loading"><h1>Page not found</h1><a href="/">Return home</a></div>} />
              </Routes>
              </Suspense>
            </main>
            <BottomNav />
          </div>
          </VaultProvider>
        </HouseholdScopedAppProvider>
        </LockGate>
      </AuthProvider>
    </BrowserRouter>
  );
}
