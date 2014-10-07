///<reference path='../definitions/ref.d.ts'/>

import gutil = require('gulp-util');

export class Host implements ts.CompilerHost {
	private currentDirectory: string;
	private files: { [ filename: string]: gutil.File; };
	
	getNewLine() {
		return '\n';
	}
	useCaseSensitiveFileNames() {
		return false;
	}
	
	getCurrentDirectory() {
		return this.currentDirectory;
	}
	getCanonicalFileName(filename: string) {
		return filename.toLowerCase();
	}
	getDefaultLibFilename() {
		return '__lib.d.ts';
	}
	
	writeFile(filename: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void) {
		console.log('write ' + filename);
	}
	
	getSourceFile(filename: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void): ts.SourceFile {
		var text = this.files[filename].contents;
		
		return (typeof text !== 'string') ? ts.createSourceFile(filename, text, languageVersion, "0") : undefined;
	}
}