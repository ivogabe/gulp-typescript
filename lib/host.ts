///<reference path='../definitions/ref.d.ts'/>

import gutil = require('gulp-util');
import project = require('./project');
import fs = require('fs');
import path = require('path');

var libDefault = fs.readFileSync(path.join(__dirname, '../typescript/lib.d.ts')).toString('utf8');

export class Host implements ts.CompilerHost {
	private currentDirectory: string;
	private files: project.Map<project.FileData>;
	output: project.Map<string>;
	
	constructor(currentDirectory: string, files: project.Map<project.FileData>) {
		this.currentDirectory = currentDirectory;
		this.files = files;
		
		this.reset();
	}
	
	private reset() {
		this.output = {};
	}
	
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
		this.output[filename] = data;
	}
	
	getSourceFile(filename: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void): ts.SourceFile {
		var text: string;
		
		if (this.files[filename]) {
			text = this.files[filename].content;
		} else if (filename === '__lib.d.ts') {
			text = libDefault; // TODO: Create a SourceFile once for the default lib
		}
		
		// TODO: Incremental compilation (reuse SourceFiles from previous build)
		
		return (typeof text === 'string') ? ts.createSourceFile(filename, text, languageVersion, "0") : undefined;
	}
}