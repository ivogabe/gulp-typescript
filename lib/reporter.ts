///<reference path='../definitions/ref.d.ts'/>

import gutil = require('gulp-util');

export interface TypeScriptError extends Error {
	fullFilename?: string;
	relativeFilename?: string;

	file?: gutil.File;
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

export interface Reporter {
	error?: (error: TypeScriptError) => void;
	fileError?: (error: TypeScriptError) => void;
	globalError?: (error: TypeScriptError) => void;
}

export function nullReporter(): Reporter {
	return {};
}
export function defaultReporter(): Reporter {
	return {
		error: (error: TypeScriptError) => {
			console.error(error.message);
		}
	};
}
