///<reference path='../definitions/ref.d.ts'/>

import ts = require('typescript');
import main = require('main');
import gutil = require('gulp-util');
import path = require('path');
import stream = require('stream');
import fs = require('fs'); // Only used for readonly access
import sourcemapApply = require('vinyl-sourcemaps-apply');
import host = require('./host');
import filter = require('./filter');
import reporter = require('./reporter');

export interface Map<T> {
	[key: string]: T;
}
export interface FileData {
	file?: gutil.File;
	filename: string;
	originalFilename: string;
	content: string;
	ts: ts.SourceFile;
}
interface OutputFile {
	filename: string;
	content: string;
	sourcemap?: string;
}

/*
 * TS1.4 had a simple getDiagnostics method, in 1.5 that method doens't exist,
 * but instead there are now 4 methods which (combined) return all diagnostics.
 */
interface Program14 {
	getDiagnostics(): ts.Diagnostic[];
	getTypeChecker(fullTypeCheckMode: boolean): ts.TypeChecker;
}
interface Program15 {
	getSyntacticDiagnostics(): ts.Diagnostic[];
	getGlobalDiagnostics(): ts.Diagnostic[];
	getSemanticDiagnostics(): ts.Diagnostic[];
	getDeclarationDiagnostics(): ts.Diagnostic[];
	emit(): { diagnostics: ts.Diagnostic[]; };
}
/*
 * In TS 14 the method getLineAndCharacterFromPosition has been renamed from ...From... to ...Of...
 */
interface TSFile14 {
	getLineAndCharacterFromPosition(pos: number): ts.LineAndCharacter;
}
interface TSFile15 {
	getLineAndCharacterOfPosition(pos: number): ts.LineAndCharacter;
}

export class Project {
	static unresolvedFile: FileData = {
		filename: undefined,
		originalFilename: undefined,
		content: undefined,
		ts: undefined
	};

	static getFileName(thing: { filename: string} | { fileName: string }): string {
		if ((<any> thing).filename) return (<any> thing).filename;
		return (<any> thing).fileName;
	}
	private static getDiagnosticsAndEmit(program: Program14 | Program15): ts.Diagnostic[] {
		if ((<Program14> program).getDiagnostics) {
			var errors = (<Program14> program).getDiagnostics();

			if (!errors.length) {
				// If there are no syntax errors, check types
				var checker = (<Program14> program).getTypeChecker(true);

				var semanticErrors = checker.getDiagnostics();

				var emitErrors = checker.emitFiles().diagnostics;

				errors = semanticErrors.concat(emitErrors);
			}

			return errors;
		} else {
			var errors = (<Program15> program).getSyntacticDiagnostics();
			if (errors.length === 0) errors = (<Program15> program).getGlobalDiagnostics();
			if (errors.length === 0) errors = (<Program15> program).getSemanticDiagnostics();

			var emitOutput = (<Program15> program).emit();
            return errors.concat(emitOutput.diagnostics);
		}
	}
	private static getLineAndCharacterOfPosition(typescript: typeof ts, file: TSFile14 | TSFile15, position: number) {
		if ((<TSFile15> file).getLineAndCharacterOfPosition) { // TS 1.5
			var lineAndCharacter = (<TSFile15> file).getLineAndCharacterOfPosition(position);
			return {
				line: lineAndCharacter.line + 1,
				character: lineAndCharacter.character + 1
			}
		} else { // TS 1.4
			return (<TSFile14> file).getLineAndCharacterFromPosition(position);
		}
	}

	/**
	 * The TypeScript library that is used for this project.
	 * Can also be jsx-typescript for example.
	 */
	typescript: typeof ts;

	filterSettings: main.FilterSettings;

	/**
	 * Files from the previous compilation.
	 * Used to find the differences with the previous compilation, to make the new compilation faster.
	 */
	previousFiles: Map<FileData> = {};
	/**
	 * The files in the current compilation.
	 * This Map only contains the files in the project, not external files. Those are in Project#additionalFiles.
	 * The file property of the FileData objects in this Map are set.
	 */
	currentFiles: Map<FileData> = {};
	/**
	 * External files of the current compilation.
	 * When a file is imported by or referenced from another file, and the file is not one of the input files, it
	 * is added to this Map. The file property of the FileData objects in this Map are not set.
	 */
	additionalFiles: Map<FileData> = {};

	private isFileChanged: boolean = false;
	private previousOutputJS: OutputFile[];
	private previousOutputDts: OutputFile[];

	/**
	 * Whether there should not be loaded external files to the project.
	 * Example:
	 *   In the lib directory you have .ts files.
	 *   In the definitions directory you have the .d.ts files.
	 *   If you turn this option on, you should add in your gulp file the definitions directory as an input source.
	 * Advantage:
	 * - Faster builds
	 * Disadvantage:
	 * - If you forget some directory, your compile will fail.
	 */
	private noExternalResolve: boolean;
	/**
	 * Sort output based on <reference> tags.
	 * tsc does this when you pass the --out parameter.
	 */
	private sortOutput: boolean;

	/**
	 * The version number of the compilation.
	 * This number is increased for every compilation in the same gulp session.
	 * Used for incremental builds.
	 */
	version: number = 0;

	options: ts.CompilerOptions;
	host: host.Host;
	program: ts.Program;

	constructor(options: ts.CompilerOptions, noExternalResolve: boolean, sortOutput: boolean, typescript = ts) {
		this.typescript = typescript;
		this.options = options;

		this.noExternalResolve = noExternalResolve;
		this.sortOutput = sortOutput;
	}

	/**
	 * Resets the compiler.
	 * The compiler needs to be reset for incremental builds.
	 */
	reset() {
		this.previousFiles = this.currentFiles;

		this.isFileChanged = false;

		this.currentFiles = {};
		this.additionalFiles = {};

		this.version++;
	}
	/**
	 * Adds a file to the project.
	 */
	addFile(file: gutil.File) {
		var fileData: FileData;
		var filename = Project.normalizePath(file.path);

		// Incremental compilation
		var oldFileData = this.previousFiles[filename];
		if (oldFileData) {
			if (oldFileData.content === file.contents.toString('utf8')) {
				// Unchanged, we can use the (ts) file from previous build.
				fileData = {
					file: file,
					filename: oldFileData.content,
					originalFilename: file.path,
					content: oldFileData.content,
					ts: oldFileData.ts
				};
			} else {
				fileData = this.getFileDataFromGulpFile(file);
				this.isFileChanged = true;
			}
		} else {
			fileData = this.getFileDataFromGulpFile(file);
			this.isFileChanged = true;
		}

		this.currentFiles[Project.normalizePath(file.path)] = fileData;
	}

	getOriginalName(filename: string): string {
		return filename.replace(/(\.d\.ts|\.js|\.js.map)$/, '.ts')
	}
	private getError(info: ts.Diagnostic): reporter.TypeScriptError {
		var err = <reporter.TypeScriptError> new Error();
		err.name = 'TypeScript error';
		err.diagnostic = info;

		if (!info.file) {
			err.message = info.code + ' ' + info.messageText;

			return err;
		}

		var filename = this.getOriginalName(Project.getFileName(info.file));
		var file = this.host.getFileData(filename);

		if (file) {
			err.tsFile = file.ts;
			err.fullFilename = file.originalFilename;
			if (file.file) {
				filename = path.relative(file.file.cwd, file.originalFilename);
				err.relativeFilename = filename;
				err.file = file.file;
			} else {
				filename = file.originalFilename;
			}
		} else {
			filename = Project.getFileName(info.file);
			err.fullFilename = filename;
		}

		var startPos = Project.getLineAndCharacterOfPosition(this.typescript, info.file, info.start);
		var endPos = Project.getLineAndCharacterOfPosition(this.typescript, info.file, info.start + info.length);

		err.startPosition = {
			position: info.start,
			line: startPos.line,
			character: startPos.character
		};
		err.endPosition = {
			position: info.start + info.length - 1,
			line: endPos.line,
			character: endPos.character
		};

		err.message = gutil.colors.red(filename + '(' + startPos.line + ',' + startPos.character + '): ') + info.code + ' ' + info.messageText;

		return err;
	}

	lazyCompile(jsStream: stream.Readable, declStream: stream.Readable): boolean {
		if (this.isFileChanged === false
			&& Object.keys(this.currentFiles).length === Object.keys(this.previousFiles).length
			&& this.previousOutputJS !== undefined
			&& this.previousOutputDts !== undefined) {
			// Emit files from previous build, since they are the same.

			// JavaScript files
			for (var i = 0; i < this.previousOutputJS.length; i++) {
				var file = this.previousOutputJS[i];

				var originalName = this.getOriginalName(Project.normalizePath(file.filename));
				var original: FileData = this.currentFiles[originalName];

				if (!original) continue;

				var gFile = new gutil.File({
					path: original.originalFilename.substr(0, original.originalFilename.length - 3) + '.js',
					contents: new Buffer(file.content),
					cwd: original.file.cwd,
					base: original.file.base
				});

				if (original.file.sourceMap) {
					gFile.sourceMap = original.file.sourceMap;
					sourcemapApply(gFile, file.sourcemap);
				}

				jsStream.push(gFile);
			}

			// Definitions files
			for (var i = 0; i < this.previousOutputDts.length; i++) {
				var file = this.previousOutputDts[i];

				var originalName = this.getOriginalName(Project.normalizePath(file.filename));
				var original: FileData = this.currentFiles[originalName];

				if (!original) continue;

				declStream.push(new gutil.File({
					path: original.originalFilename.substr(0, original.originalFilename.length - 3) + '.d.ts',
					contents: new Buffer(file.content),
					cwd: original.file.cwd,
					base: original.file.base
				}));
			}

			return true;
		}

		return false;
	}

	private resolve(session: { tasks: number; callback: () => void; }, file: FileData) {
		var references = file.ts.referencedFiles.map(item => path.join(path.dirname(Project.getFileName(file.ts)), Project.getFileName(item)));

		this.typescript.forEachChild(file.ts, (node) => {
			if (node.kind === (<any> this.typescript.SyntaxKind).ImportDeclaration) {
				var importNode = <ts.ImportDeclaration> node;

				if (importNode.moduleReference === undefined || importNode.moduleReference.kind !== (<any> this.typescript.SyntaxKind).ExternalModuleReference) {
					return;
				}
				var reference = <ts.ExternalModuleReference> importNode.moduleReference;
				if (reference.expression === undefined || reference.expression.kind !== (<any> this.typescript.SyntaxKind).StringLiteral) {
					return;
				}
				if (typeof (<ts.StringLiteralExpression> reference).text !== 'string') {
					return;
				}
				var ref = path.join(path.dirname(Project.getFileName(file.ts)), (<ts.StringLiteralExpression> reference).text);

				// Don't know if this name is defined with `declare module 'foo'`, but let's load it to be sure.
				// We guess what file the user wants. This will be right in most cases.
				// The advantage of guessing is that we can now use fs.readFile (async) instead of fs.readFileSync.
				// If we guessed wrong, the file will be loaded with fs.readFileSync in Host#getSourceFile (host.ts)
				if (ref.substr(-3).toLowerCase() === '.ts') {
					references.push(ref);
				} else {
					references.push(ref + '.ts');
				}
			}
		});

		for (var i = 0; i < references.length; ++i) {
			((i: number) => { // create scope
				var ref = references[i];
				var normalizedRef = Project.normalizePath(ref);

				if (!this.currentFiles.hasOwnProperty(normalizedRef) && !this.additionalFiles.hasOwnProperty(normalizedRef)) {
					session.tasks++;

					this.additionalFiles[normalizedRef] = Project.unresolvedFile;

					fs.readFile(ref, (error, data) => {
						if (data) { // Typescript will throw an error when a file isn't found.
							var file = this.getFileData(ref, data.toString('utf8'));
							this.additionalFiles[normalizedRef] = file;
							this.resolve(session, file);
						}

						session.tasks--;
						if (session.tasks === 0) session.callback();
					});
				}
			})(i);
		}
	}
	resolveAll(callback: () => void) {
		if (this.noExternalResolve) {
			callback();
			return;
		}

		var session = {
			tasks: 0,
			callback: callback
		};

		for (var i in this.currentFiles) {
			if (this.currentFiles.hasOwnProperty(i)) {
				this.resolve(session, this.currentFiles[i]);
			}
		}

		if (session.tasks === 0) {
			callback();
		}
	}

	/**
	 * Compiles the input files
	 */
	compile(jsStream: stream.Readable, declStream: stream.Readable, errorCallback: (err: reporter.TypeScriptError) => void) {
		var files: Map<FileData> = {};

		var _filter: filter.Filter;
		if (this.filterSettings !== undefined) {
			_filter = new filter.Filter(this, this.filterSettings);
		}

		var rootFilenames: string[] = [];

		for (var filename in this.currentFiles) {
			if (this.currentFiles.hasOwnProperty(filename)) {
				if (!_filter || _filter.match(filename)) {
					files[filename] = this.currentFiles[filename];
					rootFilenames.push(files[filename].originalFilename);
				}
			}
		}
		for (var filename in this.additionalFiles) {
			if (this.additionalFiles.hasOwnProperty(filename)) {
				files[filename] = this.additionalFiles[filename];
			}
		}

		this.host = new host.Host(this.typescript, this.currentFiles[0] ? this.currentFiles[0].file.cwd : '', files, !this.noExternalResolve);

		// Creating a program compiles the sources
		this.program = this.typescript.createProgram(rootFilenames, this.options, this.host);

		var errors = Project.getDiagnosticsAndEmit(this.program);

		for (var i = 0; i < errors.length; i++) {
			errorCallback(this.getError(errors[i]));
		}

		var outputJS: gutil.File[] = [];
		var sourcemaps: { [ filename: string ]: string } = {};

		if (errors.length) {
			this.previousOutputJS = undefined;
			this.previousOutputDts = undefined;
		} else {
			this.previousOutputJS = [];
			this.previousOutputDts = [];
		}

		for (var filename in this.host.output) {
			if (!this.host.output.hasOwnProperty(filename)) continue;

			var originalName = this.getOriginalName(Project.normalizePath(filename));
			var original: FileData = this.currentFiles[originalName];

			if (!original) continue;

			var data: string = this.host.output[filename];

			var fullOriginalName = original.originalFilename;

			if (filename.substr(-3) === '.js') {
				var file = new gutil.File({
					path: fullOriginalName.substr(0, fullOriginalName.length - 3) + '.js',
					contents: new Buffer(this.removeSourceMapComment(data)),
					cwd: original.file.cwd,
					base: original.file.base
				});

				if (original.file.sourceMap) file.sourceMap = original.file.sourceMap;
				outputJS.push(file);
			} else if (filename.substr(-5) === '.d.ts') {
				var file = new gutil.File({
					path: fullOriginalName.substr(0, fullOriginalName.length - 3) + '.d.ts',
					contents: new Buffer(data),
					cwd: original.file.cwd,
					base: original.file.base
				});

				if (this.previousOutputDts !== undefined) {
					this.previousOutputDts.push({
						filename: file.path,
						content: data
					});
				}

				declStream.push(file);
			} else if (filename.substr(-4) === '.map') {
				sourcemaps[originalName] = data;
			}
		}

		var emit = (originalName: string, file: gutil.File) => {
			var map = sourcemaps[originalName];

			if (map) sourcemapApply(file, map);

			if (this.previousOutputJS !== undefined) {
				this.previousOutputJS.push({
					filename: file.path,
					content: file.contents.toString(),
					sourcemap: map
				});
			}

			jsStream.push(file);
		};

		if (this.sortOutput) {
			var done: { [ filename: string] : boolean } = {};

			var sortedEmit = (originalName: string, file: gutil.File) => {
				originalName = Project.normalizePath(originalName);

				if (done[originalName]) return;
				done[originalName] = true;

				var inputFile = this.currentFiles[originalName];
				var tsFile = this.program.getSourceFile(originalName);
				var references = tsFile.referencedFiles.map(file => Project.getFileName(file));

				for (var j = 0; j < outputJS.length; ++j) {
					var other = outputJS[j];
					var otherName = this.getOriginalName(other.path);

					if (references.indexOf(otherName) !== -1) {
						sortedEmit(otherName, other);
					}
				}

				emit(originalName, file);
			};

			for (var i = 0; i < outputJS.length; ++i) {
				var file = outputJS[i];
				var originalName = this.getOriginalName(file.path);
				sortedEmit(originalName, file);
			}
		} else {
			for (var i = 0; i < outputJS.length; ++i) {
				var file = outputJS[i];
				var originalName = this.getOriginalName(file.path);
				originalName = Project.normalizePath(originalName);
				emit(originalName, file);
			}
		}
	}

	private getFileDataFromGulpFile(file: gutil.File): FileData {
		var str = file.contents.toString('utf8');

		var data = this.getFileData(file.path, str);
		data.file = file;

		return data;
	}

	private getFileData(filename: string, content: string): FileData {
		return {
			filename: Project.normalizePath(filename),
			originalFilename: filename,
			content: content,
			ts: this.typescript.createSourceFile(filename, content, this.options.target, this.version + '')
		};
	}

	private removeSourceMapComment(content: string): string {
		// By default the TypeScript automaticly inserts a source map comment.
		// This should be removed because gulp-sourcemaps takes care of that.
		// The comment is always on the last line, so it's easy to remove it
		// (But the last line also ends with a \n, so we need to look for the \n before the other)
		var index = content.lastIndexOf('\n', content.length - 2);
		return content.substring(0, index) + '\n';
	}

	static normalizePath(pathString: string) {
		return path.normalize(pathString).toLowerCase();
	}
}
