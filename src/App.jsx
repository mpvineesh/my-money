import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import BottomNav from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import Investments from './pages/Investments';
import InvestmentForm from './pages/InvestmentForm';
import Goals from './pages/Goals';
import GoalForm from './pages/GoalForm';
import AddPage from './pages/AddPage';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="app-container">
          <main className="app-main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/investments" element={<Investments />} />
              <Route path="/investments/new" element={<InvestmentForm />} />
              <Route path="/investments/edit/:id" element={<InvestmentForm />} />
              <Route path="/add" element={<AddPage />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/goals/add" element={<GoalForm />} />
              <Route path="/goals/edit/:id" element={<GoalForm />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}
