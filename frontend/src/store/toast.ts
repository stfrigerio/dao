import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ToastData } from '@/components/Toast/Toast';

interface ToastState {
	toasts: ToastData[];
	addToast: (toast: Omit<ToastData, 'id'>) => void;
	removeToast: (id: string) => void;
	clearToasts: () => void;
	success: (message: string, title?: string, duration?: number) => void;
	error: (message: string, title?: string, duration?: number) => void;
	warning: (message: string, title?: string, duration?: number) => void;
	info: (message: string, title?: string, duration?: number) => void;
}

export const useToastStore = create<ToastState>()(
	devtools(
		(set) => ({
			toasts: [],

			addToast: (toast) => {
				const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
				set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
			},

			removeToast: (id) => {
				set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
			},

			clearToasts: () => set({ toasts: [] }),

			success: (message, title = 'Success', duration = 5000) => {
				useToastStore.getState().addToast({ type: 'success', message, title, duration });
			},
			error: (message, title = 'Error', duration = 7000) => {
				useToastStore.getState().addToast({ type: 'error', message, title, duration });
			},
			warning: (message, title = 'Warning', duration = 6000) => {
				useToastStore.getState().addToast({ type: 'warning', message, title, duration });
			},
			info: (message, title = 'Info', duration = 5000) => {
				useToastStore.getState().addToast({ type: 'info', message, title, duration });
			},
		}),
		{ name: 'ToastStore' }
	)
);
