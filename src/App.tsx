import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './router/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CalendarPage from './pages/calendar/CalendarPage';
import CustomersPage from './pages/customers/CustomersPage';
import TemplatesPage from './pages/templates/TemplatesPage';
import EmailGeneratorPage from './pages/email/EmailGeneratorPage';
import CardGeneratorPage from './pages/cards/CardGeneratorPage';
import HistoryPage from './pages/history/HistoryPage';
import SettingsPage from './pages/settings/SettingsPage';
import AdminPage from './pages/admin/AdminPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route element={<ProtectedRoute requiredPermission="customers.view" />}>
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/customers" element={<CustomersPage />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="templates.view" />}>
            <Route path="/templates" element={<TemplatesPage />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="email.generate" />}>
            <Route path="/email" element={<EmailGeneratorPage />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="card.generate" />}>
            <Route path="/cards" element={<CardGeneratorPage />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="history.view" />}>
            <Route path="/history" element={<HistoryPage />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="settings.edit" />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="admin.access" />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
