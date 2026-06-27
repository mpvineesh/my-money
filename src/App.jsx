import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import BottomNav from './components/BottomNav';
import Header from './components/Header';
import ScrollToTop from './components/ScrollToTop';
import Dashboard from './pages/Dashboard';
import Investments from './pages/Investments';
import InvestmentForm from './pages/InvestmentForm';
import InvestmentTransactions from './pages/InvestmentTransactions';
import SwingTrades from './pages/SwingTrades';
import SwingTradeForm from './pages/SwingTradeForm';
import Goals from './pages/Goals';
import GoalForm from './pages/GoalForm';
import Loans from './pages/Loans';
import LoanForm from './pages/LoanForm';
import AddPage from './pages/AddPage';
import Login from './pages/Login';
import RequireAuth from './components/RequireAuth';
import SplashScreen from './components/SplashScreen';
import LockGate from './components/LockGate';
import Expenses from './pages/Expenses';
import ExpenseList from './pages/ExpenseList';
import ExpenseForm from './pages/ExpenseForm';
import ExpenseScan from './pages/ExpenseScan';
import AiInsights from './pages/AiInsights';
import MonthlyReview from './pages/MonthlyReview';
import Recurring from './pages/Recurring';
import RecurringForm from './pages/RecurringForm';
import Reminders from './pages/Reminders';
import Settings from './pages/Settings';
import FamilyMembers from './pages/FamilyMembers';
import Vault from './pages/Vault';
import Insights from './pages/Insights';
import MutualFunds from './pages/MutualFunds';
import Stocks from './pages/Stocks';
import { VaultProvider } from './context/VaultContext';
import { FEATURES } from './config';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <SplashScreen />
      <AuthProvider>
        <LockGate>
        <AppProvider>
          <VaultProvider>
          <ScrollToTop />
          <div className="app-container">
            <Header />
            <main className="app-main">
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
                <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
                <Route path="/family-members" element={<RequireAuth><FamilyMembers /></RequireAuth>} />
                {FEATURES.passwordVault ? (
                  <Route path="/vault" element={<RequireAuth><Vault /></RequireAuth>} />
                ) : null}
              </Routes>
            </main>
            <BottomNav />
          </div>
          </VaultProvider>
        </AppProvider>
        </LockGate>
      </AuthProvider>
    </BrowserRouter>
  );
}
