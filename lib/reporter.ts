import * as ts from 'typescript';
import * as colors from 'ansi-colors';
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
	optionsErrors: number;
	syntaxErrors: number;
	globalErrors: number;
	semanticErrors: number;
	declarationErrors: number;
	emitErrors: number;

	noEmit: boolean;
	emitSkipped: boolean;
}
export function emptyCompilationResult(noEmit: boolean): CompilationResult {
	return {
		transpileErrors: 0,
		optionsErrors: 0,
		syntaxErrors: 0,
		globalErrors: 0,
		semanticErrors: 0,
		declarationErrors: 0,
		emitErrors: 0,
		noEmit,
		emitSkipped: false
	}
}

export interface Reporter {
	error?: (error: TypeScriptError, typescript: typeof ts) => void;
	finish?: (results: CompilationResult) => void;
}

export function countErrors(results: CompilationResult) {
	return results.transpileErrors
		+ results.optionsErrors
		+ results.syntaxErrors
		+ results.globalErrors
		+ results.semanticErrors
		+ results.declarationErrors
		+ results.emitErrors;
}

function defaultFinishHandler(results: CompilationResult) {
	let hasError = false;
	const showErrorCount = (count: number, type: string) => {
		if (count === 0) return;

		console.log('TypeScript:', colors.magenta(count.toString()), (type !== '' ? type + ' ' : '') + (count === 1 ? 'error' : 'errors'));
		hasError = true;
	};

	showErrorCount(results.transpileErrors, '');
	showErrorCount(results.optionsErrors, 'options');
	showErrorCount(results.syntaxErrors, 'syntax');
	showErrorCount(results.globalErrors, 'global');
	showErrorCount(results.semanticErrors, 'semantic');
	showErrorCount(results.declarationErrors, 'declaration');
	showErrorCount(results.emitErrors, 'emit');

	if (!results.noEmit) {
		if (results.emitSkipped) {
			console.log('TypeScript: emit', colors.red('failed'));
		} else if (hasError) {
			console.log('TypeScript: emit', colors.cyan('succeeded'), '(with errors)');
		}
	}
}

export function nullReporter(): Reporter {
	return {};
}
export function defaultReporter(): Reporter {
	return {
		error: (error: TypeScriptError) => {
			console.log(error.message);
		},
		finish: defaultFinishHandler
	};
}

export function longReporter(): Reporter {
	return {
		error: (error: TypeScriptError, typescript: typeof ts) => {
			if (error.tsFile) {
				console.log('[' + colors.gray('gulp-typescript') + '] ' + colors.red(error.fullFilename
					+ '(' + error.startPosition.line + ',' + error.startPosition.character + '): ')
					+ 'error TS' + error.diagnostic.code + ' ' + typescript.flattenDiagnosticMessageText(error.diagnostic.messageText, '\n'));
			} else {
				console.log(error.message);
			}
		},
		finish: defaultFinishHandler
	}
}
export function fullReporter(fullFilename: boolean = false): Reporter {
	return {
		error: (error: TypeScriptError, typescript: typeof ts) => {
			console.log('[' + colors.gray('gulp-typescript') + '] '
				+ colors.bgRed(error.diagnostic.code + '')
				+ ' ' + colors.red(typescript.flattenDiagnosticMessageText(error.diagnostic.messageText, '\n'))
			);

			if (error.tsFile) {
				console.log('> ' + colors.gray('file: ') + (fullFilename ? error.fullFilename : error.relativeFilename) + colors.gray(':'));
				const lines = error.tsFile.text.split(/(?:\r\n|\r|\n)/);

				const logLine = (lineIndex: number, errorStart: number, errorEnd?: number) => {
					const line = lines[lineIndex];
					if (errorEnd === undefined) errorEnd = line.length;
					console.log('> ' + colors.gray('[' + (lineIndex + 1) + '] ')
						+ line.substring(0, errorStart)
						+ colors.red(line.substring(errorStart, errorEnd))
						+ line.substring(errorEnd)
					);
				}

				for (let i = error.startPosition.line; i <= error.endPosition.line; i++) {
					logLine(i,
						i === error.startPosition.line ? error.startPosition.character : 0,
						i === error.endPosition.line ? error.endPosition.character : undefined
					);
				}
			}
		},
		finish: defaultFinishHandler
	}
}
