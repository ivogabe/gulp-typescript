///<reference path='../typings/tsd.d.ts'/>

import * as stream from 'stream';
import * as path from 'path';
import * as ts from 'typescript';
import * as sourceMap from 'source-map';
import * as gutil from 'gulp-util';
import * as utils from './utils';
import * as input from './input';
import * as tsApi from './tsapi';
import * as reporter from './reporter';
import * as project from './project';
import { VinylFile } from './vinyl-file';

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
				&& (file.content[OutputFileKind.Definitions] !== undefined || !this.project.options.declaration)) {

				file.sourceMap = JSON.parse(file.content[OutputFileKind.SourceMap]);
				if (!this.project.compiler.correctSourceMap(file.sourceMap)) {
					file.skipPush = true;
					return;
				}
				
				if (this.project.singleOutput) {
					file.original = this.project.input.firstSourceFile;
					file.sourceMapOrigins = this.project.input.getFileNames(true).map(fName => this.project.input.getFile(fName));
				} else {
					const originalFileName = path.resolve(file.sourceMap.sourceRoot, file.sourceMap.sources[0]);
					file.original = this.project.input.getFile(originalFileName);
					
					if (!file.original) {
						console.error(`Could not find input file ${ originalFileName }. This is probably an issue of gulp-typescript.`
							+ `\nPlease report it at https://github.com/ivogabe/gulp-typescript/issues`
							+ `\nDebug information: \nsourceRoot = ${ JSON.stringify(file.sourceMap.sourceRoot) }\nsources = ${ JSON.stringify(file.sourceMap.sources) }`);
						file.skipPush = true;
						file.sourceMapOrigins = [];
					} else {
						file.skipPush = !file.original.gulp;
						file.sourceMapOrigins = [file.original];
					}
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
		delete map.sourceRoot;
		map.sources = map.sources.map((path) => path.replace(/\\/g, '/'));

		const generator = sourceMap.SourceMapGenerator.fromSourceMap(new sourceMap.SourceMapConsumer(map));
		for (const fileName in file.sourceMapOrigins) {
			const sourceFile = this.project.input.getFile(fileName);
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
		const index = content.lastIndexOf('\n', content.length - 2);
		return content.substring(0, index) + '\n';
	}

	private emit(file: OutputFile) {
		if (file.skipPush) return;

		const contentJs = this.removeSourceMapComment(file.content[OutputFileKind.JavaScript]);

		let root: string;
		if (this.project.singleOutput) {
			root = file.original.gulp.base;
		} else if (this.project.options.outDir !== undefined) {
			root = file.original.gulp.cwd + '/';
		} else {
			root = '';
		}

		let base: string;
		if (this.project.options.outDir !== undefined) {
			base = path.resolve(file.original.gulp.cwd, this.project.options.outDir) + '/';
		} else {
			base = file.original.gulp.base;
		}

		const fileJs = <VinylFile> new gutil.File({
			path: path.join(root, file.fileName + '.js'),
			contents: new Buffer(contentJs),
			cwd: file.original.gulp.cwd,
			base
		});
		if (file.original.gulp.sourceMap) fileJs.sourceMap = JSON.parse(file.sourceMapString);
		this.streamJs.push(fileJs);

		if (this.project.options.declaration) {
			const fileDts = new gutil.File({
				path: path.join(root, file.fileName + '.d.ts'),
				contents: new Buffer(file.content[OutputFileKind.Definitions]),
				cwd: file.original.gulp.cwd,
				base
			});
			this.streamDts.push(fileDts);
		}
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

	private getError(info: ts.Diagnostic): reporter.TypeScriptError {
		const err = <reporter.TypeScriptError> new Error();
		err.name = 'TypeScript error';
		err.diagnostic = info;
		
		const codeAndMessageText = ts.DiagnosticCategory[info.category].toLowerCase() +
			' TS' +
			info.code +
			': ' +
			tsApi.flattenDiagnosticMessageText(this.project.typescript, info.messageText)

		if (!info.file) {
			err.message = codeAndMessageText;
			return err;
		}

		let fileName = tsApi.getFileName(info.file);
		const file = this.project.input.getFile(fileName);

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

		const startPos = tsApi.getLineAndCharacterOfPosition(this.project.typescript, info.file, info.start);
		const endPos = tsApi.getLineAndCharacterOfPosition(this.project.typescript, info.file, info.start + info.length);

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

		err.message = gutil.colors.red(fileName + '(' + startPos.line + ',' + startPos.character + '): ').toString()
			+ codeAndMessageText;

		return err;
	}
	diagnostic(info: ts.Diagnostic) {
		this.error(this.getError(info));
	}
	error(error: reporter.TypeScriptError) {
		if (!error) return;
		
		// Save errors for lazy compilation (if the next input is the same as the current),
		this.errors.push(error);
		// call reporter callback
		if (this.project.reporter.error) this.project.reporter.error(<reporter.TypeScriptError> error, this.project.typescript);
		// & emit the error on the stream.
		this.streamJs.emit('error', error);
	}
}
