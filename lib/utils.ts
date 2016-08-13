import * as path from 'path';
import * as ts from 'typescript';
import { File } from './input';
import * as reporter from './reporter';
import * as gutil from 'gulp-util';

export interface Map<T> {
	[key: string]: T;
}

export function normalizePath(pathString: string) {
	return path.normalize(pathString).toLowerCase();
}

/**
 * Splits a filename into an extensionless filename and an extension.
 * 'bar/foo.js' is turned into ['bar/foo', 'js']
 * 'foo.d.ts' is parsed as ['foo', 'd.ts'] if you add 'd.ts' to knownExtensions.
 * @param knownExtensions An array with known extensions, that contain multiple parts, like 'd.ts'. 'a.b.c' should be listed before 'b.c'.
 */
export function splitExtension(fileName: string, knownExtensions?: string[]): [string, string] {
	if (knownExtensions) {
		for (const ext of knownExtensions) {
			const index = fileName.length - ext.length - 1;
			if (fileName.substr(index) === '.' + ext) {
				return [fileName.substr(0, index), ext];
			}
		}
	}

	const ext = path.extname(fileName).toLowerCase().substr(1);
	const index = fileName.length - ext.length;
	return [fileName.substr(0, index - 1), ext];
}

/**
 * Finds the common base path of two directories
 */
export function getCommonBasePath(a: string, b: string) {
	const aSplit = a.split(/\\|\//); // Split on '/' or '\'.
	const bSplit = b.split(/\\|\//);
	let commonLength = 0;
	for (let i = 0; i < aSplit.length && i < bSplit.length; i++) {
		if (aSplit[i] !== bSplit[i]) break;

		commonLength += aSplit[i].length + 1;
	}

	return a.substr(0, commonLength);
}

export function getCommonBasePathOfArray(paths: string[]) {
	if (paths.length === 0) return '';
	return paths.reduce(getCommonBasePath);
}

export function getError(info: ts.Diagnostic, typescript: typeof ts, file?: File) {
	const err = <reporter.TypeScriptError> new Error();
	err.name = 'TypeScript error';
	err.diagnostic = info;

	const codeAndMessageText = ts.DiagnosticCategory[info.category].toLowerCase() +
		' TS' +
		info.code +
		': ' +
		typescript.flattenDiagnosticMessageText(info.messageText, '\n')

	if (!info.file) {
		err.message = codeAndMessageText;
		return err;
	}

	let fileName = info.file.fileName;
	
	if (file) {
		err.tsFile = file.ts;
		err.fullFilename = file.fileNameOriginal;
		if (file.gulp) {
			fileName = path.relative(file.gulp.cwd, file.fileNameOriginal);
			err.relativeFilename = fileName;
			err.file = file.gulp;
		} else {
			fileName = file.fileNameOriginal;
		}
	} else {
		err.fullFilename = info.file.fileName;
	}

	const startPos = typescript.getLineAndCharacterOfPosition(info.file, info.start);
	const endPos = typescript.getLineAndCharacterOfPosition(info.file, info.start + info.length);

	err.startPosition = {
		position: info.start,
		line: startPos.line,
		character: startPos.character
	};
	err.endPosition = {
		position: info.start + info.length - 1,
		line: endPos.line,
		character: endPos.character
	};

	err.message = gutil.colors.red(fileName + '(' + startPos.line + ',' + startPos.character + '): ').toString()
		+ codeAndMessageText;

	return err;
}
