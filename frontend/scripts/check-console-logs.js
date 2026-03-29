#!/usr/bin/env node

/**
 * Check for console.log statements in production code
 */

const fs = require('fs');
const glob = require('glob');

const ERRORS = [];

console.log('\n[CHECK] Checking for console.log statements...\n');

function checkFile(filePath) {
	const content = fs.readFileSync(filePath, 'utf-8');
	const lines = content.split('\n');

	lines.forEach((line, index) => {
		if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
		if (/console\.(log|debug|info)\(/.test(line)) {
			ERRORS.push({
				file: filePath,
				line: index + 1,
				content: line.trim(),
			});
		}
	});
}

const files = glob.sync('src/**/*.{ts,tsx}', { cwd: process.cwd() });
files.forEach(file => {
	if (file.includes('.test.') || file.includes('.spec.')) return;
	checkFile(file);
});

if (ERRORS.length === 0) {
	console.log('[PASS] No console.log statements found\n');
	process.exit(0);
} else {
	console.log('[WARNING] Found console.log statements:\n');
	ERRORS.forEach(e => {
		console.log(`  ${e.file}:${e.line}`);
		console.log(`    -> ${e.content}\n`);
	});
	console.log(`Found ${ERRORS.length} console.log statement(s)\n`);
	process.exit(0); // warning only
}
