///<reference path='../definitions/ref.d.ts'/>
import stream = require('stream');
import path = require('path');
import ts = require('typescript');
import sourceMap = require('source-map');
import gutil = require('gulp-util');
import utils = require('./utils');
import input = require('./input');
import tsApi = require('./tsApi');
import reporter = require('./reporter');
import project = require('./project');

export interface OutputFile {
	fileName: string;
	original: input.File;
	sourceMapOrigins: input.File[];
	content: { [ kind: number /* OutputFileKind */ ]: string };
	pushed: boolean;
	skipPush: boolean;
	sourceMapsApplied: boolean;
	sourceMap: sourceMap.RawSourceMap;
	sourceMapString: string;
}

export enum OutputFileKind {
	JavaScript,
	SourceMap,
	Definitions
}

export class Output {
	static knownExtensions: string[] = ['js', 'js.map', 'd.ts'];

	constructor(_project: project.Project, streamJs: stream.Readable, streamDts: stream.Readable) {
		this.project = _project;
		this.streamJs = streamJs;
		this.streamDts = streamDts;
	}

	project: project.Project;
	files: utils.Map<OutputFile> = {};
	errors: reporter.TypeScriptError[] = [];
	streamJs: stream.Readable;
	streamDts: stream.Readable;

	write(fileName: string, content: string) {
		const [fileNameExtensionless, extension] = utils.splitExtension(fileName, Output.knownExtensions);
		let kind: OutputFileKind;

		switch (extension) {
			case 'js':
				kind = OutputFileKind.JavaScript;
				break;
			case 'js.map':
				kind = OutputFileKind.SourceMap;
				break;
			case 'd.ts': // .d.ts
				kind = OutputFileKind.Definitions;
				break;
		}
		this.addOrMergeFile(fileNameExtensionless, kind, content);
	}

	/**
	 * Adds the file to the `this.files`.
	 * If there is already a file with the specified `fileName`, it will be merged.
	 * This method should be called 3 times, 1 time for each `OutputFileKind`.
	 * @param fileName The extensionless filename.
	 */
	private addOrMergeFile(fileName: string, kind: OutputFileKind, content: string) {
		let file = this.files[fileName];
		if (file) {
			file.content[kind] = content;

			if (file.content[OutputFileKind.JavaScript] !== undefined
				&& file.content[OutputFileKind.SourceMap] !== undefined
				&& file.content[OutputFileKind.Definitions] !== undefined) {

				file.sourceMap = JSON.parse(file.content[OutputFileKind.SourceMap]);
				if (this.project.singleOutput) {
					file.original = this.project.input.firstSourceFile;
					file.sourceMapOrigins = this.project.input.getFileNames(true).map(fName => this.project.input.getFile(fName));
				} else {
					const originalFileName = path.resolve(path.dirname(fileName), file.sourceMap.sources[0])
					file.original = this.project.input.getFile(originalFileName);
					file.skipPush = !file.original.gulp;

					file.sourceMapOrigins = [file.original];
				}

				this.applySourceMaps(file);

				if (!this.project.sortOutput) { // if sortOutput is enabled, emit is done in the `finish` method
					this.emit(file);
				}
			}

			return;
		}

		this.files[fileName] = {
			fileName,
			original: undefined,
			sourceMapOrigins: undefined,
			content: {
				[ kind ]: content
			},
			pushed: false,
			skipPush: undefined,
			sourceMapsApplied: false,
			sourceMap: undefined,
			sourceMapString: undefined
		};
	}

	private applySourceMaps(file: OutputFile) {
		if (file.sourceMapsApplied || file.skipPush || !file.original.gulp.sourceMap) return;

		file.sourceMapsApplied = true;
		const map = file.sourceMap;
		map.file = map.file.replace(/\\/g, '/');
		map.sources = map.sources.map((path) => path.replace(/\\/g, '/'));

		var generator = sourceMap.SourceMapGenerator.fromSourceMap(new sourceMap.SourceMapConsumer(map));
		for (const fileName in file.sourceMapOrigins) {
			var sourceFile = this.project.input.getFile(fileName);
			if (!sourceFile || !sourceFile.gulp || !sourceFile.gulp.sourceMap) continue;
			generator.applySourceMap(new sourceMap.SourceMapConsumer(sourceFile.gulp.sourceMap));
		}
		file.sourceMapString = generator.toString();
	}

	private removeSourceMapComment(content: string): string {
		// By default the TypeScript automaticly inserts a source map comment.
		// This should be removed because gulp-sourcemaps takes care of that.
		// The comment is always on the last line, so it's easy to remove it
		// (But the last line also ends with a \n, so we need to look for the \n before the other)
		var index = content.lastIndexOf('\n', content.length - 2);
		return content.substring(0, index) + '\n';
	}

	private emit(file: OutputFile) {
		if (file.skipPush) return;

		const contentJs = this.removeSourceMapComment(file.content[OutputFileKind.JavaScript]);
		const fileJs = new gutil.File({
			path: file.fileName + '.js',
			content: new Buffer(contentJs),
			cwd: file.original.gulp.cwd,
			base: file.original.gulp.base
		});
		if (file.original.gulp.sourceMap) fileJs.sourceMap = JSON.parse(file.sourceMapString);
		this.streamJs.push(fileJs);

		const fileDts = new gutil.File({
			path: file.fileName + '.js',
			content: new Buffer(file.content[OutputFileKind.JavaScript]),
			cwd: file.original.gulp.cwd,
			base: file.original.gulp.base
		});
		this.streamDts.push(fileDts);
	}

	finish() {
		if (this.project.sortOutput) {
			let sortedEmit = (fileName: string) => {
				let file = this.files[fileName];
				if (!file || file.skipPush || file.pushed) return;

				let references = file.original.ts.referencedFiles.map(file => tsApi.getFileName(file));

				for (const ref in references) {
					sortedEmit(utils.splitExtension(ref)[0]);
				}

				this.emit(file);
			};

			for (const fileName of Object.keys(this.files)) {
				sortedEmit(fileName);
			}
		}

		this.streamJs.push(null);
		this.streamDts.push(null);
	}

	private getFileFromOriginalFileName(fileName: string) {
		const fileNameNormalized = utils.normalizePath(fileName);

		for (const outputFileName of Object.keys(this.files)) {
			const file = this.files[outputFileName];
			if (file.original && file.original.fileNameOriginal === fileName) {
				return file;
			}
		}
	}

	private getError(info: ts.Diagnostic): reporter.TypeScriptError {
		const err = <reporter.TypeScriptError> new Error();
		err.name = 'TypeScript error';
		err.diagnostic = info;

		if (!info.file) {
			err.message = info.code + ' ' + tsApi.flattenDiagnosticMessageText(this.project.typescript, info.messageText);
			return err;
		}

		let fileName = tsApi.getFileName(info.file);
		const fileOutput = this.getFileFromOriginalFileName(fileName);
		const file = fileOutput && fileOutput.original;

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

		var startPos = tsApi.getLineAndCharacterOfPosition(this.project.typescript, info.file, info.start);
		var endPos = tsApi.getLineAndCharacterOfPosition(this.project.typescript, info.file, info.start + info.length);

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
			+ tsApi.flattenDiagnosticMessageText(this.project.typescript, info.messageText);

		return err;
	}
	error(info: ts.Diagnostic) {
		let error = this.getError(info);

		// Save errors for lazy compilation (if the next input is the same as the current),
		this.errors.push(error);
		// call reporter callback
		if (this.project.reporter.error) this.project.reporter.error(<reporter.TypeScriptError> error, this.project.typescript);
		// & emit the error on the stream.
		this.streamJs.emit('error', info);
	}
}
