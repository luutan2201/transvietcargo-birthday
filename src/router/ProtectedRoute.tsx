import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Permission } from '../services/auth/permissions';
import { hasPermission } from '../services/auth/permissions';

interface Props {
  requiredPermission?: Permission;
}

export function ProtectedRoute({ requiredPermission }: Props) {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (requiredPermission && !hasPermission(session.role, requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
