#!/usr/bin/env node

/**
 * CSS Module Quality Checker
 * Enforces two rules:
 * 1. Each component can ONLY import its own CSS module (1:1 mapping)
 * 2. All CSS classes must be used in their matching component (no unused classes)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findAllComponentFiles() {
	const result = execSync('find src -name "*.tsx" -o -name "*.ts"', { encoding: 'utf-8' });
	return result.trim().split('\n').filter(Boolean);
}

function extractCSSImport(file) {
	try {
		const content = fs.readFileSync(file, 'utf-8');
		const importRegex = /import\s+\w+\s+from\s+['"](.+\.module\.css)['"]/g;
		const matches = [];
		let match;
		while ((match = importRegex.exec(content)) !== null) {
			matches.push(match[1]);
		}
		return matches;
	} catch (e) {
		return [];
	}
}

function checkImportRules() {
	const componentFiles = findAllComponentFiles();
	const violations = [];

	for (const file of componentFiles) {
		const cssImports = extractCSSImport(file);
		if (cssImports.length === 0) continue;

		const baseName = path.basename(file, path.extname(file));
		const expectedCSSFile = `${baseName}.module.css`;
		const componentDir = path.dirname(file);

		for (const importPath of cssImports) {
			const resolvedPath = path.resolve(componentDir, importPath);
			const importedFileName = path.basename(resolvedPath);

			const isValidImport =
				importedFileName === expectedCSSFile ||
				(importedFileName.startsWith(`${baseName}.`) && importedFileName.endsWith('.module.css'));

			if (!isValidImport) {
				violations.push({ file, imported: importPath, expected: expectedCSSFile });
			}
		}
	}

	return violations;
}

function findCSSModules(dir) {
	const result = execSync(`find ${dir} -name "*.module.css"`, { encoding: 'utf-8' });
	return result.trim().split('\n').filter(Boolean);
}

function findComponentFiles(cssFile) {
	const dir = path.dirname(cssFile);
	try {
		const files = fs.readdirSync(dir);
		return files.filter(f => /\.(tsx?|jsx?)$/.test(f)).map(f => path.join(dir, f));
	} catch (e) {
		return [];
	}
}

function extractClasses(cssContent) {
	const classRegex = /\.([a-zA-Z][a-zA-Z0-9_-]*)\s*\{/g;
	const classes = [];
	let match;
	while ((match = classRegex.exec(cssContent)) !== null) {
		classes.push(match[1]);
	}
	return [...new Set(classes)];
}

function isClassUsed(className, componentFiles) {
	for (const file of componentFiles) {
		try {
			const content = fs.readFileSync(file, 'utf-8');
			const patterns = [
				`styles.${className}`,
				`styles['${className}']`,
				`styles["${className}"]`,
			];
			if (patterns.some(p => content.includes(p))) return true;
			if (/styles\[[^\]]*\]/.test(content)) {
				if (new RegExp(`['"\`]${className}['"\`]`).test(content)) return true;
			}
			const hyphenMatch = className.match(/^([a-zA-Z]+)-([a-zA-Z]+)$/);
			if (hyphenMatch) {
				const prefix = hyphenMatch[1];
				if (new RegExp(`styles\\[\`${prefix}-\\$\\{[^}]+\\}\`\\]`).test(content)) return true;
			}
		} catch (e) {
			return true;
		}
	}
	return false;
}

function checkUnusedClasses() {
	const srcDir = path.join(__dirname, '..', 'src');
	const cssFiles = findCSSModules(srcDir);
	const violations = [];

	for (const cssFile of cssFiles) {
		const componentFiles = findComponentFiles(cssFile);
		if (componentFiles.length === 0) continue;

		const cssContent = fs.readFileSync(cssFile, 'utf-8');
		const classes = extractClasses(cssContent);
		const unusedClasses = classes.filter(c => !isClassUsed(c, componentFiles));

		if (unusedClasses.length > 0) {
			violations.push({ file: cssFile, unused: unusedClasses });
		}
	}

	return violations;
}

function main() {
	console.log('\n========================================');
	console.log('[CHECK] Starting CSS module validation');
	console.log('========================================\n');

	console.log('[1/2] Checking CSS import 1:1 mapping...');
	const importViolations = checkImportRules();

	if (importViolations.length > 0) {
		console.log('[FAIL] Found CSS import violations:\n');
		for (const v of importViolations) {
			console.log(`File: ${v.file}`);
			console.log(`  [X] Imports: ${v.imported}`);
			console.log(`  [!] Should import: ${v.expected}\n`);
		}
	} else {
		console.log('[PASS] All imports follow the 1:1 rule');
	}

	console.log('\n[2/2] Checking for unused CSS classes...');
	const unusedViolations = checkUnusedClasses();

	if (unusedViolations.length > 0) {
		const total = unusedViolations.reduce((sum, v) => sum + v.unused.length, 0);
		console.log('[FAIL] Found unused CSS classes:\n');
		for (const v of unusedViolations) {
			console.log(`File: ${v.file}`);
			console.log(`  Unused: ${v.unused.join(', ')}\n`);
		}
		console.log(`Total: ${total} unused classes in ${unusedViolations.length} files`);
	} else {
		console.log('[PASS] No unused CSS classes');
	}

	const totalViolations = importViolations.length + unusedViolations.length;

	if (totalViolations === 0) {
		console.log('\n========================================');
		console.log('[PASS] All CSS module checks passed');
		console.log('========================================\n');
		process.exit(0);
	} else {
		console.log('\n========================================');
		console.log('[FAIL] CSS module validation failed');
		console.log('========================================\n');
		process.exit(1);
	}
}

main();
