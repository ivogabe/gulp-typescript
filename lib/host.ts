///<reference path='../typings/tsd.d.ts'/>

import * as ts from 'typescript';
import * as tsApi from './tsapi';
import * as gutil from 'gulp-util';
import { Project } from './project';
import { File, FileCache } from './input';
import * as utils from './utils';
import * as fs from 'fs';
import * as path from 'path';

export class Host implements ts.CompilerHost {
	static libDefault: utils.Map<ts.SourceFile> = {};
	static getLibDefault(typescript: typeof ts, libFileName: string) {
		let fileName: string;
		for (const i in require.cache) {
			if (!Object.prototype.hasOwnProperty.call(require.cache, i)) continue;

			if (require.cache[i].exports === typescript) {
				fileName = i;
			}
		}
		if (fileName === undefined) {
			return undefined; // Not found
		}
		fileName = path.join(path.dirname(fileName), libFileName);
		if (this.libDefault[fileName]) {
			return this.libDefault[fileName]; // Already loaded
		}

		const content = fs.readFileSync(fileName).toString('utf8');
		return this.libDefault[fileName] = tsApi.createSourceFile(typescript, '__lib.d.ts', content, typescript.ScriptTarget.ES3); // Will also work for ES5 & 6
	}

	typescript: typeof ts;

	currentDirectory: string;
	private externalResolve: boolean;
	private libFileName: string;
	input: FileCache;
	output: utils.Map<string>;

	constructor(typescript: typeof ts, currentDirectory: string, input: FileCache, externalResolve: boolean, libFileName: string) {
		this.typescript = typescript;

		this.currentDirectory = currentDirectory;
		this.input = input;

		this.externalResolve = externalResolve;
		this.libFileName = libFileName;

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

	getCurrentDirectory = () => {
		return this.currentDirectory;
	}
	getCanonicalFileName(filename: string) {
		return utils.normalizePath(filename);
	}
	getDefaultLibFilename() {
		return '__lib.d.ts';
	}
	getDefaultLibFileName() {
		return '__lib.d.ts';
	}

	writeFile = (fileName: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void) => {
		this.output[fileName] = data;
	}

	getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void): ts.SourceFile => {
		if (fileName === '__lib.d.ts') {
			return Host.getLibDefault(this.typescript, this.libFileName);
		}

		let sourceFile = this.input.getFile(fileName);
		if (sourceFile) return sourceFile.ts;

		if (this.externalResolve) {
			let text: string;
			try {
				text = fs.readFileSync(fileName).toString('utf8');
			} catch (ex) {
				return undefined;
			}
			this.input.addContent(fileName, text);

			let sourceFile = this.input.getFile(fileName);
			if (sourceFile) return sourceFile.ts;
		}
	}
}
