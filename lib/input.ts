///<reference path='../typings/tsd.d.ts'/>

import * as ts from 'typescript';
import * as gutil from 'gulp-util';
import * as path from 'path';
import * as tsApi from './tsapi';
import * as utils from './utils';
import { VinylFile } from './vinyl-file';

export enum FileChangeState {
	New,
	Equal,
	Modified,
	Deleted,
	NotFound
}
export enum FileKind {
	Source,
	Config
}

export interface FileChange {
	previous: File;
	current: File;
	state: FileChangeState;
}

export interface File {
	gulp?: VinylFile;
	fileNameNormalized: string;
	fileNameOriginal: string;
	content: string;
	kind: FileKind;
	ts?: ts.SourceFile;
}
export module File {
	export function fromContent(fileName: string, content: string): File {
		let kind = FileKind.Source;
		if (path.extname(fileName).toLowerCase() === 'json') kind = FileKind.Config;

		return {
			fileNameNormalized: utils.normalizePath(fileName),
			fileNameOriginal: fileName,
			content,
			kind
		};
	}
	export function fromGulp(file: VinylFile): File {
		let str = file.contents.toString('utf8');
		let data = fromContent(file.path, str);
		data.gulp = file;

		return data;
	}

	export function equal(a: File, b: File): boolean {
		if (a === undefined || b === undefined) return a === b; // They could be both undefined.
		return (a.fileNameOriginal === b.fileNameOriginal)
			&& (a.content === b.content);
	}
	export function getChangeState(previous: File, current: File): FileChangeState {
		if (previous === undefined) {
			return current === undefined ? FileChangeState.NotFound : FileChangeState.New;
		}
		if (current === undefined) {
			return FileChangeState.Deleted;
		}
		if (equal(previous, current)) {
			return FileChangeState.Equal;
		}
		return FileChangeState.Modified;
	}
}

/**
 * Finds the common base path of two directories
 */
function getCommonBasePath(a: string, b: string) {
	const aSplit = a.split(/\\|\//); // Split on '/' or '\'.
	const bSplit = b.split(/\\|\//);
	let commonLength = 0;
	for (let i = 0; i < aSplit.length && i < bSplit.length; i++) {
		if (aSplit[i] !== bSplit[i]) break;
		
		commonLength += aSplit[i].length + 1;
	}
	
	return a.substr(0, commonLength);
}

export class FileDictionary {
	files: utils.Map<File> = {};
	firstSourceFile: File = undefined;
	typescript: typeof ts;

	constructor(typescript: typeof ts) {
		this.typescript = typescript;
	}

	addGulp(gFile: VinylFile) {
		return this.addFile(File.fromGulp(gFile));
	}
	addContent(fileName: string, content: string) {
		return this.addFile(File.fromContent(fileName, content));
	}
	private addFile(file: File) {
		if (file.kind === FileKind.Source) {
			this.initTypeScriptSourceFile(file);
			if (!this.firstSourceFile) this.firstSourceFile = file;
		}
		this.files[file.fileNameNormalized] = file;
		return file;
	}

	getFile(name: string) {
		return this.files[utils.normalizePath(name)];
	}

	initTypeScriptSourceFile: (file: File) => void;

	getFileNames(onlyGulp = false) {
		const fileNames: string[] = [];
		for (const fileName in this.files) {
			if (!this.files.hasOwnProperty(fileName)) continue;
			let file = this.files[fileName];
			if (onlyGulp && !file.gulp) continue;
			fileNames.push(file.fileNameOriginal);
		}
		return fileNames;
	}
	
	private getSourceFileNames(onlyGulp?: boolean) {
		const fileNames = this.getFileNames(onlyGulp);
		const sourceFileNames = fileNames
			.filter(fileName => fileName.substr(fileName.length - 5).toLowerCase() !== '.d.ts');
		
		if (sourceFileNames.length === 0) {
			// Only definition files, so we will calculate the common base path based on the
			// paths of the definition files.
			return fileNames;
		}
		return sourceFileNames;
	}
	
	get commonBasePath() {
		const fileNames = this.getSourceFileNames(true);
		return fileNames
			.map(fileName => {
				const file = this.files[utils.normalizePath(fileName)];
				return path.resolve(file.gulp.cwd, file.gulp.base);
			})
			.reduce(getCommonBasePath);
	}
	get commonSourceDirectory() {
		const fileNames = this.getSourceFileNames();
		return fileNames
			.map(fileName => {
				const file = this.files[utils.normalizePath(fileName)];
				return path.dirname(file.fileNameNormalized);
			})
			.reduce(getCommonBasePath);
	}
}

export class FileCache {
	previous: FileDictionary = undefined;
	current: FileDictionary;
	options: ts.CompilerOptions;

	typescript: typeof ts;
	version: number = 0;

	constructor(typescript: typeof ts, options: ts.CompilerOptions) {
		this.typescript = typescript;
		this.options = options;
		this.createDictionary();
	}

	addGulp(gFile: VinylFile) {
		return this.current.addGulp(gFile);
	}
	addContent(fileName: string, content: string) {
		return this.current.addContent(fileName, content);
	}

	reset() {
		this.version++;
		this.previous = this.current;
		this.createDictionary();
	}

	private createDictionary() {
		this.current = new FileDictionary(this.typescript);
		this.current.initTypeScriptSourceFile = (file) => this.initTypeScriptSourceFile(file);
	}

	private initTypeScriptSourceFile(file: File) {
		if (this.previous) {
			let previous = this.previous.getFile(file.fileNameOriginal);
			if (File.equal(previous, file)) {
				file.ts = previous.ts; // Re-use previous source file.
				return;
			}
		}
		file.ts = tsApi.createSourceFile(this.typescript, file.fileNameOriginal, file.content, this.options.target, this.version + '')
	}

	getFile(name: string) {
		return this.current.getFile(name);
	}

	getFileChange(name: string): FileChange {
		let previous: File;
		if (this.previous) {
			previous = this.previous.getFile(name);
		}

		let current = this.current.getFile(name);

		return {
			previous,
			current,
			state: File.getChangeState(previous, current)
		};
	}

	getFileNames(onlyGulp = false) {
		return this.current.getFileNames(onlyGulp);
	}

	get firstSourceFile() {
		return this.current.firstSourceFile;
	}
	get commonBasePath() {
		return this.current.commonBasePath;
	}
	get commonSourceDirectory() {
		return this.current.commonSourceDirectory;
	}

	isChanged(onlyGulp = false) {
		if (!this.previous) return true;

		const files = this.getFileNames(onlyGulp);
		const oldFiles = this.previous.getFileNames(onlyGulp);

		if (files.length !== oldFiles.length) return true;

		for (const fileName in files) {
			if (oldFiles.indexOf(fileName) === -1) return true;
		}

		for (const fileName in files) {
			const change = this.getFileChange(fileName);
			if (change.state !== FileChangeState.Equal) return true;
		}

		return false;
	}
}
