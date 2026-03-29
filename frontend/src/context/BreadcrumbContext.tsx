import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Crumb } from '@/components/atoms/Breadcrumb/Breadcrumb';

interface BreadcrumbContextValue {
	crumbs: Crumb[];
	setCrumbs: (crumbs: Crumb[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
	crumbs: [],
	setCrumbs: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
	const [crumbs, setCrumbs] = useState<Crumb[]>([{ label: 'Dashboard', to: '/dashboard' }]);
	return (
		<BreadcrumbContext.Provider value={{ crumbs, setCrumbs }}>
			{children}
		</BreadcrumbContext.Provider>
	);
}

/** Call in a page component to set the breadcrumb trail for that page. */
export function useBreadcrumb(items: Crumb[]) {
	const { setCrumbs } = useContext(BreadcrumbContext);
	const key = JSON.stringify(items);
	useEffect(() => {
		setCrumbs(items);
	}, [key]);
}

export function useBreadcrumbCrumbs(): Crumb[] {
	return useContext(BreadcrumbContext).crumbs;
}
