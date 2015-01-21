///<reference path='../definitions/ref.d.ts'/>

import ts = require('typescript');
import gutil = require('gulp-util');
import project = require('./project');
import fs = require('fs');
import path = require('path');

export class Host implements ts.CompilerHost {
	static libDefault: ts.SourceFile;
	static initLibDefault() {
		var content = fs.readFileSync(path.join(__dirname, '../node_modules/typescript/bin/lib.d.ts')).toString('utf8');
		this.libDefault = ts.createSourceFile('__lib.d.ts', content, ts.ScriptTarget.ES3, "0"); // Will also work for ES5 & 6
	}

	private currentDirectory: string;
	private files: project.Map<project.FileData>;
	private externalResolve: boolean;
	output: project.Map<string>;

	constructor(currentDirectory: string, files: project.Map<project.FileData>, externalResolve: boolean) {
		this.currentDirectory = currentDirectory;
		this.files = files;

		this.externalResolve = externalResolve;

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
		return project.Project.normalizePath(filename);
	}
	getDefaultLibFilename() {
		return '__lib.d.ts';
	}

	writeFile(filename: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void) {
		this.output[filename] = data;
	}

	getSourceFile(filename: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void): ts.SourceFile {
		var text: string;

		var normalizedFilename = project.Project.normalizePath(filename);

		if (this.files[normalizedFilename]) {
			if (this.files[normalizedFilename] === project.Project.unresolvedFile) {
				return undefined;
			} else {
				return this.files[normalizedFilename].ts;
			}
		} else if (normalizedFilename === '__lib.d.ts') {
			return Host.libDefault;
		} else {
			if (this.externalResolve) {
				try {
					text = fs.readFileSync(filename).toString('utf8');
				} catch (ex) {
					return undefined;
				}
			}
		}

		if (typeof text !== 'string') return undefined;

		var file = ts.createSourceFile(filename, text, languageVersion, "0");
		this.files[normalizedFilename] = {
			filename: normalizedFilename,
			originalFilename: filename,
			content: text,
			ts: file
		}
		return file;
	}

	getFileData(filename: string) {
		return this.files[project.Project.normalizePath(filename)];
	}
}
Host.initLibDefault();
