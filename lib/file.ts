///<reference path='../definitions/ref.d.ts'/>
import ts = require('typescript');
import gutil = require('gulp-util');
import path = require('path');
import tsApi = require('./tsapi');
import utils = require('./utils');

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
	gulp?: gutil.File;
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
	export function fromGulp(file: gutil.File): File {
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

export class FileDictionary {
	files: utils.Map<File>;
	typescript: typeof ts;

	constructor(typescript: typeof ts) {
		this.typescript = typescript;
	}

	addGulp(gFile: gutil.File) {
		this.addFile(File.fromGulp(gFile));
	}
	addContent(fileName: string, content: string) {
		this.addFile(File.fromContent(fileName, content));
	}
	private addFile(file: File) {
		if (file.kind === FileKind.Source) this.initTypeScriptSourceFile(file);
		this.files[file.fileNameNormalized] = file;
	}

	getFile(name: string) {
		return this.files[utils.normalizePath(name)];
	}

	initTypeScriptSourceFile: (file: File) => void;

	getGulpFileNames(onlyGulp = false) {
		const fileNames: string[] = [];
		for (const fileName in this.files) {
			if (!this.files.hasOwnProperty(fileName)) continue;
			let file = this.files[fileName];
			if (onlyGulp && !file.gulp) continue;
			fileNames.push(file.fileNameOriginal);
		}
		return fileNames;
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
		this.current = new FileDictionary(typescript);
		this.current.initTypeScriptSourceFile = (file) => this.initTypeScriptSourceFile(file);
		this.options = options;
	}

	addGulp(gFile: gutil.File) {
		this.current.addGulp(gFile);
	}
	addContent(fileName: string, content: string) {
		this.addContent(fileName, content);
	}

	reset() {
		this.version++;
		this.previous = this.current;
		this.current = new FileDictionary(this.typescript);
	}

	private initTypeScriptSourceFile(file: File) {
		if (this.previous) {
			let previous = this.previous.getFile(name);
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
		return this.current.getGulpFileNames(onlyGulp);
	}
}
