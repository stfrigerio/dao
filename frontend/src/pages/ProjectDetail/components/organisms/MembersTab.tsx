import React from 'react';
import { Users } from 'lucide-react';
import type { Project } from '../../../../../../shared/types';
import { Badge } from '@/components/atoms/Badge/Badge';
import { EmptyState } from '@/components/atoms/EmptyState/EmptyState';
import styles from './MembersTab.module.css';

interface MembersTabProps {
	project: Project;
}

export function MembersTab({ project }: MembersTabProps) {
	const members = project.members || [];

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h3 className={styles.title}>Members</h3>
			</div>

			{members.length === 0 ? (
				<EmptyState icon={<Users size={32} />} message="No members yet." />
			) : (
				<div className={styles.memberList}>
					{members.map((member) => (
						<div key={member.userId} className={styles.member}>
							<div className={styles.avatar}>
								{member.user?.name?.[0]?.toUpperCase() || '?'}
							</div>
							<div className={styles.memberInfo}>
								<span className={styles.memberName}>{member.user?.name}</span>
								<span className={styles.memberEmail}>{member.user?.email}</span>
							</div>
							<Badge variant={member.role === 'owner' ? 'primary' : 'default'}>
								{member.role}
							</Badge>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
