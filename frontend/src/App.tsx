import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { ToastContainer } from '@/components/Toast/Toast';
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

export default function App() {
	const { fetchMe, token } = useAuthStore();
	const { toasts, removeToast } = useToastStore();

	useEffect(() => {
		if (token) fetchMe();
	}, [token, fetchMe]);

	return (
		<div className={styles.app}>
			<BrowserRouter>
				<Routes>
					<Route path="/login" element={<LoginPage />} />
					<Route
						path="/*"
						element={
							<ProtectedRoute>
								<AppShell>
									<Routes>
										<Route
											path="/"
											element={<Navigate to="/dashboard" replace />}
										/>
										<Route path="/dashboard" element={<DashboardPage />} />
										<Route path="/projects" element={<ProjectsPage />} />
										<Route
											path="/projects/:uuid"
											element={<ProjectDetailPage />}
										/>
										<Route path="/settings" element={<SettingsPage />} />
									</Routes>
								</AppShell>
							</ProtectedRoute>
						}
					/>
				</Routes>
			</BrowserRouter>
			<ToastContainer toasts={toasts} removeToast={removeToast} />
		</div>
	);
}
