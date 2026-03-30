import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { ToastContainer } from '@/components/Toast/Toast';
import { BreadcrumbProvider } from '@/context/BreadcrumbContext';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { ProjectsPage } from '@/pages/Projects';
import { ProjectDetailPage } from '@/pages/ProjectDetail';
import { SettingsPage } from '@/pages/Settings';
import { AppShell } from '@/pages/AppShell';
import styles from './App.module.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const { user, token } = useAuthStore();
	if (!token && !user) return <Navigate to="/login" replace />;
	return <>{children}</>;
}

function AnimatedRoutes() {
	const location = useLocation();

	return (
		<AnimatePresence mode="wait">
			<Routes location={location} key={location.pathname}>
				<Route path="/login" element={<LoginPage />} />
				<Route
					path="/*"
					element={
						<ProtectedRoute>
							<AppShell>
								<Routes>
									<Route path="/" element={<Navigate to="/dashboard" replace />} />
									<Route path="/dashboard" element={<DashboardPage />} />
									<Route path="/projects" element={<ProjectsPage />} />
									<Route path="/projects/:uuid" element={<ProjectDetailPage />} />
									<Route path="/settings" element={<SettingsPage />} />
								</Routes>
							</AppShell>
						</ProtectedRoute>
					}
				/>
			</Routes>
		</AnimatePresence>
	);
}

export default function App() {
	const { fetchMe, token } = useAuthStore();
	const { toasts, removeToast } = useToastStore();

	useEffect(() => {
		if (token) fetchMe();
	}, [token, fetchMe]);

	return (
		<div className={styles.app}>
			<BrowserRouter>
				<BreadcrumbProvider>
					<AnimatedRoutes />
				</BreadcrumbProvider>
			</BrowserRouter>
			<ToastContainer toasts={toasts} removeToast={removeToast} />
		</div>
	);
}
