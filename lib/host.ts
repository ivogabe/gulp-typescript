import * as ts from 'typescript';
import * as tsApi from './tsapi';
import { Project } from './project';
import { File, FileCache } from './input';
import * as utils from './utils';
import * as fs from 'fs';
import * as path from 'path';

const libDirectory = '__lib/';
export class Host implements ts.CompilerHost {
	static libDefault: utils.Map<ts.SourceFile> = {};
	static getLibDefault(typescript: typeof ts, libFileName: string, originalFileName: string) {
		let fileName: string;
		for (const i in require.cache) {
			if (!Object.prototype.hasOwnProperty.call(require.cache, i) || require.cache[i] === undefined) continue;

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
		return this.libDefault[fileName] = tsApi.createSourceFile(typescript, originalFileName, content, typescript.ScriptTarget.ES3); // Will also work for ES5 & 6
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
	getDefaultLibLocation() {
		return libDirectory;
	}

	writeFile = (fileName: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void) => {
		this.output[fileName] = data;
	}

	fileExists(fileName: string) {
		if (fileName === '__lib.d.ts') {
			return true;
		}

		let sourceFile = this.input.getFile(fileName);
		if (sourceFile) return true;

		if (this.externalResolve) {
			try {
				const stat = fs.statSync(fileName);
				if (!stat) return false;
				return stat.isFile();
			} catch (ex) {

			}
		}
		return false;
	}

	readFile(fileName: string) {
		const normalizedFileName = utils.normalizePath(fileName);

		let sourceFile = this.input.getFile(fileName);
		if (sourceFile) return sourceFile.content;

		if (this.externalResolve) {
			// Read the whole file (and cache contents) to prevent race conditions.
			let text: string;
			try {
				text = fs.readFileSync(fileName).toString('utf8');
			} catch (ex) {
				return undefined;
			}
			return text;
		}
		return undefined;
	}

	getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void): ts.SourceFile => {
		if (fileName === '__lib.d.ts') {
			return Host.getLibDefault(this.typescript, this.libFileName, fileName);
		}
		if (fileName.substring(0, libDirectory.length) === libDirectory) {
			try {
				return Host.getLibDefault(this.typescript, fileName.substring(libDirectory.length), fileName);
			} catch (e) {}
			try {
				return Host.getLibDefault(this.typescript, 'lib.' + fileName.substring(libDirectory.length), fileName);
			} catch (e) {}
			return undefined;
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
