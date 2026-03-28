import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import BottomNav from './components/BottomNav';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Investments from './pages/Investments';
import InvestmentForm from './pages/InvestmentForm';
import Goals from './pages/Goals';
import GoalForm from './pages/GoalForm';
import Loans from './pages/Loans';
import LoanForm from './pages/LoanForm';
import AddPage from './pages/AddPage';
import Login from './pages/Login';
import RequireAuth from './components/RequireAuth';
import Expenses from './pages/Expenses';
import ExpenseList from './pages/ExpenseList';
import ExpenseForm from './pages/ExpenseForm';
import AiInsights from './pages/AiInsights';
import Recurring from './pages/Recurring';
import Settings from './pages/Settings';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <div className="app-container">
            <Header />
            <main className="app-main">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
                <Route path="/investments" element={<RequireAuth><Investments /></RequireAuth>} />
                <Route path="/investments/new" element={<RequireAuth><InvestmentForm /></RequireAuth>} />
                <Route path="/investments/edit/:id" element={<RequireAuth><InvestmentForm /></RequireAuth>} />
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
                <Route path="/expenses/edit/:id" element={<RequireAuth><ExpenseForm /></RequireAuth>} />
                <Route path="/recurring" element={<RequireAuth><Recurring /></RequireAuth>} />
                <Route path="/ai-insights" element={<RequireAuth><AiInsights /></RequireAuth>} />
                <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
              </Routes>
            </main>
            <BottomNav />
          </div>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
