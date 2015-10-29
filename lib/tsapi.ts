import * as ts from 'typescript';
import { CompilationResult, emptyCompilationResult } from './reporter';
import { normalizePath } from './utils';

export interface TypeScript14 {
	createSourceFile(filename: string, content: string, target: ts.ScriptTarget, version: string);
}
export interface TypeScript15 {
	createSourceFile(fileName: string, content: string, target: ts.ScriptTarget, isOpen: boolean);
	findConfigFile(searchPath: string): string;
	flattenDiagnosticMessageText(messageText: string | DiagnosticMessageChain15, newLine: string): string;
	transpile(input: string, compilerOptions?: ts.CompilerOptions, fileName?: string, diagnostics?: ts.Diagnostic[]): string;
}

export interface TypeScript18 {
	getNormalizedAbsolutePath(fileName: string, currentDirectory: string);
}

/*
 * In TS1.6+ ts.createProgram has an extra argument, `oldProgram`.
 * TS will reuse the old program if possible, which speeds up incremental
 * compilation
 */
export type CreateProgram = (rootNames: string[], options: ts.CompilerOptions, host?: ts.CompilerHost, oldProgram?: ts.Program) => ts.Program;

/*
 * TS1.4 had a simple getDiagnostics method, in 1.5 that method doens't exist,
 * but instead there are now 4 methods which (combined) return all diagnostics.
 */
export interface Program14 {
	getDiagnostics(): ts.Diagnostic[];
	getTypeChecker(fullTypeCheckMode: boolean): TypeChecker14;
}
export interface Program15 {
	getSyntacticDiagnostics(): ts.Diagnostic[];
	getGlobalDiagnostics(): ts.Diagnostic[];
	getSemanticDiagnostics(): ts.Diagnostic[];
	getDeclarationDiagnostics(): ts.Diagnostic[];
	emit(): { diagnostics: ts.Diagnostic[]; emitSkipped: boolean; };
}

export interface TypeChecker14 {
	getDiagnostics(sourceFile?: ts.SourceFile): ts.Diagnostic[];
	emitFiles(): { diagnostics: ts.Diagnostic[]; };
}
export interface DiagnosticMessageChain15 {
	messageText: string;
	category: ts.DiagnosticCategory;
	code: number;
	next?: DiagnosticMessageChain15;
}

/*
 * In TS 14 the method getLineAndCharacterFromPosition has been renamed from ...From... to ...Of...
 */
export interface TSFile14 {
	getLineAndCharacterFromPosition(pos: number): ts.LineAndCharacter;
}
export interface TSFile15 {
	getLineAndCharacterOfPosition(pos: number): ts.LineAndCharacter;
}

export function isTS14(typescript: typeof ts) {
	return !('findConfigFile' in typescript);
}
export function isTS16OrNewer(typescript: typeof ts) {
	return ('ModuleResolutionKind' in typescript);
}

export function getFileName(thing: { filename: string} | { fileName: string }): string {
	if ((<any> thing).filename) return (<any> thing).filename; // TS 1.4
	return (<any> thing).fileName; // TS 1.5
}
export function getDiagnosticsAndEmit(program: Program14 | Program15): [ts.Diagnostic[], CompilationResult] {
	let result = emptyCompilationResult();

	if ((<Program14> program).getDiagnostics) { // TS 1.4
		let errors = (<Program14> program).getDiagnostics();

		result.syntaxErrors = errors.length;

		if (!errors.length) {
			// If there are no syntax errors, check types
			const checker = (<Program14> program).getTypeChecker(true);

			const semanticErrors = checker.getDiagnostics();

			const emitErrors = checker.emitFiles().diagnostics;

			errors = semanticErrors.concat(emitErrors);
			result.semanticErrors = errors.length;
		} else {
			result.emitSkipped = true;
		}

		return [errors, result];
	} else { // TS 1.5
		let errors = (<Program15> program).getSyntacticDiagnostics();
		result.syntaxErrors = errors.length;
		if (errors.length === 0) {
			errors = (<Program15> program).getGlobalDiagnostics();

			// Remove error: "File '...' is not under 'rootDir' '...'. 'rootDir' is expected to contain all source files."
			// This is handled by ICompiler#correctSourceMap, so this error can be muted.
			errors = errors.filter((item) => item.code !== 6059);

			result.globalErrors = errors.length;
		}

		if (errors.length === 0) {
			errors = (<Program15> program).getSemanticDiagnostics();
			result.semanticErrors = errors.length;
		}

		const emitOutput = (<Program15> program).emit();
		result.emitErrors = emitOutput.diagnostics.length;
		result.emitSkipped = emitOutput.emitSkipped;
		return [errors.concat(emitOutput.diagnostics), result];
	}
}
export function getLineAndCharacterOfPosition(typescript: typeof ts, file: TSFile14 | TSFile15, position: number) {
	if ((<TSFile15> file).getLineAndCharacterOfPosition) { // TS 1.5
		const lineAndCharacter = (<TSFile15> file).getLineAndCharacterOfPosition(position);
		return {
			line: lineAndCharacter.line + 1,
			character: lineAndCharacter.character + 1
		}
	} else { // TS 1.4
		return (<TSFile14> file).getLineAndCharacterFromPosition(position);
	}
}
export function createSourceFile(typescript: TypeScript14 | TypeScript15, fileName: string, content: string, target: ts.ScriptTarget, version = '0') {
	if ((<TypeScript15> typescript).findConfigFile) {
		return (<TypeScript15> typescript).createSourceFile(fileName, content, target, true);
	} else {
		return (<TypeScript14> typescript).createSourceFile(fileName, content, target, version);
	}
}
export function flattenDiagnosticMessageText(typescript: TypeScript14 | TypeScript15, messageText: string | DiagnosticMessageChain15): string {
	if (typeof messageText === 'string') {
		return messageText;
	} else {
		return (<TypeScript15> typescript).flattenDiagnosticMessageText(messageText, "\n");
	}
}

export function transpile(typescript: TypeScript14 | TypeScript15, input: string, compilerOptions?: ts.CompilerOptions, fileName?: string, diagnostics?: ts.Diagnostic[]): string {
	if (!(<TypeScript15> typescript).transpile) {
		throw new Error('gulp-typescript: Single file compilation is not supported using TypeScript 1.4');
	}

	return (<TypeScript15> typescript).transpile(input, compilerOptions, fileName.replace(/\\/g, '/'), diagnostics);
}


export function getNormalizedAbsolutePath(typescript: TypeScript18 | TypeScript14 | TypeScript15, fileName: string, currentDirectory: string) {
	// Prior to Typescript 1.8.0-dev.20151028, this method did not exist, so whatever is passed in from fileName is passed through.
	if (!(<TypeScript18> typescript).getNormalizedAbsolutePath) {
		return fileName;
	}

    return (<TypeScript18> typescript).getNormalizedAbsolutePath(fileName, currentDirectory);
}