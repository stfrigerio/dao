#!/usr/bin/env node

/**
 * Check that API calls are only made through stores, not directly in components
 * This enforces the architecture pattern of using Zustand stores for all backend communication
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ERRORS = [];

// Directories where direct API calls are NOT allowed
const RESTRICTED_DIRS = [
	'src/components/**/*.{ts,tsx}',
	'src/pages/**/*.{ts,tsx}',
];

// Patterns that indicate direct API usage
const API_PATTERNS = [
	/\bfetch\s*\(\s*[`'"]/,  // fetch with URL
	/\baxios\./,              // axios calls
];

// Exceptions - allowed fetch patterns
const ALLOWED_PATTERNS = [
	/import.*fetch/,
	/export.*fetch/,
	/\/\/ allow-fetch/,
];

console.log('\n========================================');
console.log('[CHECK] Starting API usage validation');
console.log('========================================\n');

function checkFile(filePath) {
	const content = fs.readFileSync(filePath, 'utf-8');
	const lines = content.split('\n');

	lines.forEach((line, index) => {
		const lineNumber = index + 1;
		const previousLine = index > 0 ? lines[index - 1] : '';
		const twoLinesBack = index > 1 ? lines[index - 2] : '';
		const nextLine = index < lines.length - 1 ? lines[index + 1] : '';

		if (ALLOWED_PATTERNS.some(pattern =>
			pattern.test(line) || pattern.test(previousLine) || pattern.test(twoLinesBack) || pattern.test(nextLine)
		)) {
			return;
		}

		API_PATTERNS.forEach(pattern => {
			if (pattern.test(line)) {
				ERRORS.push({
					file: filePath,
					line: lineNumber,
					content: line.trim(),
					message: 'Direct API call detected. Use store methods instead.',
				});
			}
		});
	});
}

RESTRICTED_DIRS.forEach(pattern => {
	const files = glob.sync(pattern, { cwd: process.cwd() });
	files.forEach(file => {
		if (file.includes('.test.') || file.includes('.spec.')) return;
		checkFile(file);
	});
});

if (ERRORS.length === 0) {
	console.log('[PASS] No direct API calls found in components');
	console.log('========================================\n');
	process.exit(0);
} else {
	console.log('[FAIL] Found direct API calls in components:\n');
	ERRORS.forEach(error => {
		console.log(`  ${error.file}:${error.line}`);
		console.log(`    ${error.message}`);
		console.log(`    -> ${error.content}\n`);
	});
	console.log('Tip: Move API calls to store files (src/store/) or service files (src/services/)');
	console.log(`Found ${ERRORS.length} violation(s)\n`);
	process.exit(1);
}
