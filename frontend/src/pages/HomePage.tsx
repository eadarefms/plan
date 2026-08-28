import React from 'react';
import { useAuth } from '../context/AuthContext';
import ProvincialDashboardPage from './ProvincialDashboardPage';
import RegionalDashboardPage from './RegionalDashboardPage';

export default function HomePage() {
  const { user } = useAuth();
  if (user?.role === 'PROVINCIAL') return <ProvincialDashboardPage />;
  return <RegionalDashboardPage />;
}
