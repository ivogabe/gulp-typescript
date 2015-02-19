///<reference path='../definitions/ref.d.ts'/>

import ts = require('typescript');
import gutil = require('gulp-util');
import project = require('./project');
import fs = require('fs');
import path = require('path');

export class Host implements ts.CompilerHost {
	static libDefault: project.Map<ts.SourceFile> = {};
	static getLibDefault(typescript: typeof ts) {
		var filename: string;
		for (var i in require.cache) {
			if (!Object.prototype.hasOwnProperty.call(require.cache, i)) continue;

			if (require.cache[i].exports === typescript) {
				filename = i;
			}
		}

		if (filename === undefined) return undefined; // Not found
		if (this.libDefault[filename]) return this.libDefault[filename]; // Already loaded

		var content = fs.readFileSync(path.resolve(path.dirname(filename) + '/lib.d.ts')).toString('utf8');
		return this.libDefault[filename] = ts.createSourceFile('__lib.d.ts', content, ts.ScriptTarget.ES3, "0"); // Will also work for ES5 & 6
	}

	typescript: typeof ts;

	private currentDirectory: string;
	private files: project.Map<project.FileData>;
	private externalResolve: boolean;
	output: project.Map<string>;

	constructor(typescript: typeof ts, currentDirectory: string, files: project.Map<project.FileData>, externalResolve: boolean) {
		this.typescript = typescript;

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
			return Host.getLibDefault(this.typescript);
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
