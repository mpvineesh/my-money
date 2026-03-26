import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import BottomNav from './components/BottomNav';
import { useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Investments from './pages/Investments';
import InvestmentForm from './pages/InvestmentForm';
import Goals from './pages/Goals';
import GoalForm from './pages/GoalForm';
import AddPage from './pages/AddPage';
import Login from './pages/Login';
import RequireAuth from './components/RequireAuth';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <div className="app-container">
            <main className="app-main">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
                <Route path="/investments" element={<RequireAuth><Investments /></RequireAuth>} />
                <Route path="/investments/new" element={<RequireAuth><InvestmentForm /></RequireAuth>} />
                <Route path="/investments/edit/:id" element={<RequireAuth><InvestmentForm /></RequireAuth>} />
                <Route path="/add" element={<RequireAuth><AddPage /></RequireAuth>} />
                <Route path="/goals" element={<RequireAuth><Goals /></RequireAuth>} />
                <Route path="/goals/add" element={<RequireAuth><GoalForm /></RequireAuth>} />
                <Route path="/goals/edit/:id" element={<RequireAuth><GoalForm /></RequireAuth>} />
              </Routes>
            </main>
            {/** render bottom nav only when user is signed in */}
            {(() => {
              const { user } = useAuth();
              return user ? <BottomNav /> : null;
            })()}
          </div>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
