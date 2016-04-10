import * as ts from 'typescript';
import * as tsApi from './tsapi';
import * as gutil from 'gulp-util';
import { VinylFile } from './types';

export interface TypeScriptError extends Error {
	fullFilename?: string;
	relativeFilename?: string;

	file?: VinylFile;
	tsFile?: ts.SourceFile;
	diagnostic: ts.Diagnostic;

	startPosition?: {
		position: number;
		line: number;
		character: number;
	};
	endPosition?: {
		position: number;
		line: number;
		character: number;
	};
}
export interface CompilationResult {
	/**
	 * Only used when using isolatedModules.
	 */
	transpileErrors: number;
	syntaxErrors: number;
	globalErrors: number;
	semanticErrors: number;
	emitErrors: number;

	emitSkipped: boolean;
}
export function emptyCompilationResult(): CompilationResult {
	return {
		transpileErrors: 0,
		syntaxErrors: 0,
		globalErrors: 0,
		semanticErrors: 0,
		emitErrors: 0,
		emitSkipped: false
	}
}

export interface Reporter {
	error?: (error: TypeScriptError, typescript: typeof ts) => void;
	finish?: (results: CompilationResult) => void;
}

function defaultFinishHandler(results: CompilationResult) {
	let hasError = false;
	const showErrorCount = (count: number, type: string) => {
		if (count === 0) return;

		gutil.log('TypeScript:', gutil.colors.magenta(count.toString()), (type !== '' ? type + ' ' : '') + (count === 1 ? 'error' : 'errors'));
		hasError = true;
	};

	showErrorCount(results.transpileErrors, '');
	showErrorCount(results.syntaxErrors, 'syntax');
	showErrorCount(results.globalErrors, 'global');
	showErrorCount(results.semanticErrors, 'semantic');
	showErrorCount(results.emitErrors, 'emit');

	if (results.emitSkipped) {
		gutil.log('TypeScript: emit', gutil.colors.red('failed'));
	} else if (hasError) {
		gutil.log('TypeScript: emit', gutil.colors.cyan('succeeded'), '(with errors)');
	}
}

export function nullReporter(): Reporter {
	return {};
}
export function defaultReporter(): Reporter {
	return {
		error: (error: TypeScriptError) => {
			console.error(error.message);
		},
		finish: defaultFinishHandler
	};
}

function flattenDiagnosticsVerbose(message: string | tsApi.DiagnosticMessageChain15, index = 0): string {
	if (typeof message === 'undefined') {
		return '';
	} else if (typeof message === 'string') {
		return message;
	} else {
		let result: string;
		if (index === 0) {
			result = message.messageText;
		} else {
			result = '\n> TS' + message.code + ' ' + message.messageText;
		}
		return result + flattenDiagnosticsVerbose(message.next, index + 1);
	}
}

export function longReporter(): Reporter {
	return {
		error: (error: TypeScriptError) => {
			if (error.tsFile) {
				console.error('[' + gutil.colors.gray('gulp-typescript') + '] ' + gutil.colors.red(error.fullFilename + '(' + error.startPosition.line + ',' + error.startPosition.character + '): ') + 'error TS' + error.diagnostic.code + ' ' + flattenDiagnosticsVerbose(error.diagnostic.messageText));
			} else {
				console.error(error.message);
			}
		},
		finish: defaultFinishHandler
	}
}
export function fullReporter(fullFilename: boolean = false): Reporter {
	return {
		error: (error: TypeScriptError, typescript: typeof ts) => {
			console.error('[' + gutil.colors.gray('gulp-typescript') + '] '
				+ gutil.colors.bgRed(error.diagnostic.code + '')
				+ ' ' + gutil.colors.red(flattenDiagnosticsVerbose(error.diagnostic.messageText))
			);

			if (error.tsFile) {
				console.error('> ' + gutil.colors.gray('file: ') + (fullFilename ? error.fullFilename : error.relativeFilename) + gutil.colors.gray(':'));
				const lines = error.tsFile.text.split(/(\r\n|\r|\n)/);

				const logLine = (lineIndex: number, errorStart: number, errorEnd?: number) => {
					const line = lines[lineIndex];
					if (errorEnd === undefined) errorEnd = line.length;
					console.error('> ' + gutil.colors.gray('[' + lineIndex + '] ')
						+ line.substring(0, errorStart)
						+ gutil.colors.red(line.substring(errorStart, errorEnd))
						+ line.substring(errorEnd)
					);
				}

				for (let i = error.startPosition.line; i <= error.endPosition.line; i++) {
					logLine(i,
						i === error.startPosition.line ? error.startPosition.character - 1 : 0,
						i === error.endPosition.line ? error.endPosition.character - 1 : undefined
					);
				}
			}
		},
		finish: defaultFinishHandler
	}
}
