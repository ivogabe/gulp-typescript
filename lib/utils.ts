import * as path from 'path';

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
