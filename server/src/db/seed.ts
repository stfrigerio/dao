import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './index';
import { users } from './schema';

async function seed() {
	const passwordHash = await bcrypt.hash('admin123', 12);
	const [admin] = await db
		.insert(users)
		.values({
			email: 'admin@dao.local',
			name: 'Admin',
			passwordHash,
			role: 'admin',
		})
		.returning();
	console.log('Created admin user:', admin.email);
	process.exit(0);
}

seed().catch((err) => {
	console.error(err);
	process.exit(1);
});
