import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { ThemeProvider } from './lib/ThemeContext';
import { WorkspaceProvider } from './lib/WorkspaceContext';
import { ToastProvider } from './lib/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { MfaVerifyPage } from './pages/MfaVerifyPage';
import { MfaEnrollPage } from './pages/MfaEnrollPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ManageAdministrators } from './pages/admin/ManageAdministrators';
import { ManageOperators } from './pages/admin/ManageOperators';
import { ManageOrganisations } from './pages/admin/ManageOrganisations';
import { OrganisationDetail } from './pages/admin/OrganisationDetail';
import { ManageChatSettings } from './pages/admin/ManageChatSettings';
import { ManageBranding } from './pages/admin/ManageBranding';
import { ManageChats } from './pages/admin/ManageChats';
import { OperatorPage } from './pages/operator/OperatorPage';
import { ChatHistoryPage } from './pages/operator/ChatHistoryPage';

function AdminRoute({ children }) {
  return <ProtectedRoute roles={['ADMIN']}>{children}</ProtectedRoute>;
}

function OperatorRoute({ children }) {
  return <ProtectedRoute roles={['OPERATOR']}>{children}</ProtectedRoute>;
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/mfa/verify" element={<MfaVerifyPage />} />
                <Route path="/mfa/enroll" element={<MfaEnrollPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/administrators"
                  element={
                    <AdminRoute>
                      <ManageAdministrators />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/operators"
                  element={
                    <AdminRoute>
                      <ManageOperators />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/organisations"
                  element={
                    <AdminRoute>
                      <ManageOrganisations />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/organisations/:id"
                  element={
                    <AdminRoute>
                      <OrganisationDetail />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/chat-settings"
                  element={
                    <AdminRoute>
                      <ManageChatSettings />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/branding"
                  element={
                    <AdminRoute>
                      <ManageBranding />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/chats"
                  element={
                    <AdminRoute>
                      <ManageChats />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/operator"
                  element={
                    <OperatorRoute>
                      <OperatorPage />
                    </OperatorRoute>
                  }
                />
                <Route
                  path="/operator/history"
                  element={
                    <OperatorRoute>
                      <ChatHistoryPage />
                    </OperatorRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
