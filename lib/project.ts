///<reference path='../definitions/ref.d.ts'/>

import ts = require('typescript');
import tsApi = require('./tsapi');
import main = require('./main');
import gutil = require('gulp-util');
import sourceMap = require('source-map');
import path = require('path');
import stream = require('stream');
import fs = require('fs'); // Only used for readonly access
import host = require('./host');
import filter = require('./filter');
import reporter = require('./reporter');
import utils = require('./utils');
import file = require('./file');

interface OutputFile {
	filename: string;
	content: string;
	sourcemap?: Object;
}



export class Project {
	/**
	 * The TypeScript library that is used for this project.
	 * Can also be jsx-typescript for example.
	 */
	typescript: typeof ts;

	filterSettings: main.FilterSettings;

	/**
	 *
	 */
	firstFile: file.File = undefined;

	private isFileChanged: boolean = false;
	private previousOutputJS: OutputFile[];
	private previousOutputDts: OutputFile[];

	files: file.FileCache;

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

	options: ts.CompilerOptions;
	host: host.Host;
	program: ts.Program;

	constructor(options: ts.CompilerOptions, noExternalResolve: boolean, sortOutput: boolean, typescript = ts) {
		this.typescript = typescript;
		this.options = options;

		this.noExternalResolve = noExternalResolve;
		this.sortOutput = sortOutput;

		this.files = new file.FileCache(typescript, options);
	}

	/**
	 * Resets the compiler.
	 * The compiler needs to be reset for incremental builds.
	 */
	reset() {
		this.firstFile = undefined;

		this.isFileChanged = false;

		this.files.reset();
	}
	/**
	 * Adds a file to the project.
	 */
	addFile(file: gutil.File) {
		this.files.addGulp(file);

		if (!this.firstFile) this.firstFile = this.files.getFile(file.path);
	}

	getOriginalName(filename: string): string {
		return filename.replace(/(\.d\.ts|\.js|\.js.map)$/, '.ts')
	}
	private getError(info: ts.Diagnostic): reporter.TypeScriptError {
		var err = <reporter.TypeScriptError> new Error();
		err.name = 'TypeScript error';
		err.diagnostic = info;

		if (!info.file) {
			err.message = info.code + ' ' + tsApi.flattenDiagnosticMessageText(this.typescript, info.messageText);

			return err;
		}

		var fileName = this.getOriginalName(tsApi.getFileName(info.file));
		var file = this.files.getFile(fileName);

		if (file) {
			err.tsFile = file.ts;
			err.fullFilename = file.fileNameOriginal;
			if (file.gulp) {
				fileName = path.relative(file.gulp.cwd, file.fileNameOriginal);
				err.relativeFilename = fileName;
				err.file = file.gulp;
			} else {
				fileName = file.fileNameOriginal;
			}
		} else {
			fileName = tsApi.getFileName(info.file);
			err.fullFilename = fileName;
		}

		var startPos = tsApi.getLineAndCharacterOfPosition(this.typescript, info.file, info.start);
		var endPos = tsApi.getLineAndCharacterOfPosition(this.typescript, info.file, info.start + info.length);

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

		err.message = gutil.colors.red(fileName + '(' + startPos.line + ',' + startPos.character + '): ')
			+ info.code + ' '
			+ tsApi.flattenDiagnosticMessageText(this.typescript, info.messageText);

		return err;
	}

	lazyCompile(jsStream: stream.Readable, declStream: stream.Readable): boolean {
		if (this.isFileChanged === false
			&& this.files.previous
			&& Object.keys(this.files.current.files).length === Object.keys(this.files.previous.files).length
			&& this.previousOutputJS !== undefined
			&& this.previousOutputDts !== undefined) {
			// Emit files from previous build, since they are the same.

			// JavaScript files
			for (var i = 0; i < this.previousOutputJS.length; i++) {
				var file = this.previousOutputJS[i];

				var original = this.files.getFile(file.filename);

				if (!original) continue;

				var gFile = new gutil.File({
					path: original.fileNameOriginal.substr(0, original.fileNameOriginal.length - 3) + '.js',
					contents: new Buffer(file.content),
					cwd: original.gulp.cwd,
					base: original.gulp.base
				});

				gFile.sourceMap = file.sourcemap;

				jsStream.push(gFile);
			}

			// Definitions files
			for (var i = 0; i < this.previousOutputDts.length; i++) {
				var file = this.previousOutputDts[i];

				var original: file.File = this.files.getFile(file.filename);

				if (!original) continue;

				declStream.push(new gutil.File({
					path: original.fileNameOriginal.substr(0, original.fileNameOriginal.length - 3) + '.d.ts',
					contents: new Buffer(file.content),
					cwd: original.gulp.cwd,
					base: original.gulp.base
				}));
			}

			return true;
		}

		return false;
	}

	/**
	 * Compiles the input files
	 */
	compile(jsStream: stream.Readable, declStream: stream.Readable, errorCallback: (err: reporter.TypeScriptError) => void) {
		var rootFilenames: string[] = this.files.getFileNames(true);

		if (this.filterSettings !== undefined) {
			let _filter = new filter.Filter(this, this.filterSettings);
			rootFilenames = rootFilenames.filter((fileName) => _filter.match(fileName));
		}

		this.host = new host.Host(this.typescript, this.firstFile ? this.firstFile.gulp.cwd : '', this.files, !this.noExternalResolve);

		// Creating a program compiles the sources
		this.program = this.typescript.createProgram(rootFilenames, this.options, this.host);

		var errors = tsApi.getDiagnosticsAndEmit(this.program);

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

			var originalName = this.getOriginalName(utils.normalizePath(filename));
			var original: file.File;
			if (this.options.out !== undefined) {
				original = this.firstFile;
				if (!original) continue;

				var fullOriginalName = path.join(original.gulp.base, this.options.out);
			} else {
				original = this.files.getFile(originalName);
				if (!original || !original.gulp) continue;

				var fullOriginalName = original.fileNameOriginal;
			}

			var lastDot = fullOriginalName.lastIndexOf('.');
			if (lastDot === -1) lastDot = fullOriginalName.length;
			var fullOriginalNameWithoutExtension = fullOriginalName.substring(0, lastDot);

			var data: string = this.host.output[filename];


			if (filename.substr(-3) === '.js') {
				var file = new gutil.File({
					path: fullOriginalNameWithoutExtension + '.js',
					contents: new Buffer(this.removeSourceMapComment(data)),
					cwd: original.gulp.cwd,
					base: original.gulp.base
				});

				outputJS.push(file);
			} else if (filename.substr(-5) === '.d.ts') {
				var file = new gutil.File({
					path: fullOriginalNameWithoutExtension + '.d.ts',
					contents: new Buffer(data),
					cwd: original.gulp.cwd,
					base: original.gulp.base
				});

				if (this.previousOutputDts !== undefined) {
					this.previousOutputDts.push({
						filename: file.path,
						content: data
					});
				}

				declStream.push(file);
			} else if (filename.substr(-4) === '.map') {
				if (this.options.out !== undefined) {
					sourcemaps[''] = data;
				} else {
					sourcemaps[originalName] = data;
				}
			}
		}

		var emit = (originalName: string, file: gutil.File) => {
			var map = sourcemaps[this.options.out !== undefined ? '' : originalName];

			if (map) {
				var parsedMap = JSON.parse(map);
				parsedMap.file = parsedMap.file.replace(/\\/g, '/');
				parsedMap.sources = parsedMap.sources.map(function(filePath) {
					return filePath.replace(/\\/g, '/');
				});

				var oldFiles: string[];
				if (this.options.out !== undefined) {
					oldFiles = this.files.getFileNames();
				} else {
					oldFiles = [originalName];
				}
				var generator = sourceMap.SourceMapGenerator.fromSourceMap(new sourceMap.SourceMapConsumer(parsedMap));
				for (var i = 0; i < oldFiles.length; i++) {
					var oldFile = this.files.getFile(oldFiles[i]);
					if (!oldFile || !oldFile.gulp || !oldFile.gulp.sourceMap) continue;
					generator.applySourceMap(new sourceMap.SourceMapConsumer(oldFile.gulp.sourceMap));
				}
				file.sourceMap = JSON.parse(generator.toString());
			}

			if (this.previousOutputJS !== undefined) {
				this.previousOutputJS.push({
					filename: file.path,
					content: file.contents.toString(),
					sourcemap: file.sourceMap
				});
			}

			jsStream.push(file);
		};

		if (this.sortOutput) {
			var done: { [ filename: string] : boolean } = {};

			var sortedEmit = (originalName: string, file: gutil.File) => {
				originalName = utils.normalizePath(originalName);

				if (done[originalName]) return;
				done[originalName] = true;

				var inputFile = this.files.getFile(originalName);
				var tsFile = this.program.getSourceFile(originalName);
				var references = tsFile.referencedFiles.map(file => tsApi.getFileName(file));

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
				originalName = utils.normalizePath(originalName);
				emit(originalName, file);
			}
		}
	}

	private removeSourceMapComment(content: string): string {
		// By default the TypeScript automaticly inserts a source map comment.
		// This should be removed because gulp-sourcemaps takes care of that.
		// The comment is always on the last line, so it's easy to remove it
		// (But the last line also ends with a \n, so we need to look for the \n before the other)
		var index = content.lastIndexOf('\n', content.length - 2);
		return content.substring(0, index) + '\n';
	}
}
