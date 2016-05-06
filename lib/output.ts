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
import { VinylFile, RawSourceMap } from './types';
import { ProjectCompiler } from "./compiler";

export interface OutputFile {
	fileName: string;
	original: input.File;
	sourceMapOrigins: input.File[];
	extension: { [ kind: number /* OutputFileKind */ ]: string };
	content: { [ kind: number /* OutputFileKind */ ]: string };
	pushed: boolean;
	skipPush: boolean;
	sourceMapsApplied: boolean;
	sourceMap: RawSourceMap;
	sourceMapString: string;
}

export enum OutputFileKind {
	JavaScript,
	SourceMap,
	Definitions
}

export class Output {
	static knownExtensions: string[] = ['js', 'jsx', 'js.map', 'jsx.map', 'd.ts'];

	constructor(_project: project.Project, streamJs: stream.Readable, streamDts: stream.Readable) {
		this.project = _project;
		this.streamJs = streamJs;
		this.streamDts = streamDts;
	}

	project: project.Project;
	files: utils.Map<OutputFile> = {};
	errors: reporter.TypeScriptError[] = [];
	results: reporter.CompilationResult;
	streamJs: stream.Readable;
	streamDts: stream.Readable;

	write(fileName: string, content: string) {
		const [fileNameExtensionless, extension] = utils.splitExtension(fileName, Output.knownExtensions);
		let kind: OutputFileKind;

		switch (extension) {
			case 'js':
			case 'jsx':
				kind = OutputFileKind.JavaScript;
				break;
			case 'js.map':
			case 'jsx.map':
				kind = OutputFileKind.SourceMap;
				break;
			case 'd.ts': // .d.ts
				kind = OutputFileKind.Definitions;
				break;
		}
		this.addOrMergeFile(fileNameExtensionless, extension, kind, content);
	}

	/**
	 * Adds the file to the `this.files`.
	 * If there is already a file with the specified `fileName`, it will be merged.
	 * This method should be called 3 times, 1 time for each `OutputFileKind`.
	 * @param fileName The extensionless filename.
	 */
	private addOrMergeFile(fileName: string, extension: string, kind: OutputFileKind, content: string) {
		let file = this.files[utils.normalizePath(fileName)];
		if (file) {
			file.extension[kind] = extension;
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
					const [, jsExtension] = utils.splitExtension(file.sourceMap.file); // js or jsx
					// Fix the output filename in the source map, which must be relative
					// to the source root or it won't work correctly in gulp-sourcemaps if
					// there are more transformations down in the pipeline.
					file.sourceMap.file = path.relative(file.sourceMap.sourceRoot, originalFileName).replace(/\.ts$/, '.' + jsExtension);
				}

				this.applySourceMaps(file);

				if (!this.project.sortOutput) { // if sortOutput is enabled, emit is done in the `finish` method
					this.emit(file);
				}
			}

			return;
		}

		this.files[utils.normalizePath(fileName)] = {
			fileName,
			original: undefined,
			sourceMapOrigins: undefined,
			extension: {
				[ kind ]: extension
			},
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
		for (const sourceFile of file.sourceMapOrigins) {
			if (!sourceFile || !sourceFile.gulp || !sourceFile.gulp.sourceMap) continue;

			const inputOriginalMap = sourceFile.gulp.sourceMap;
			const inputMap: RawSourceMap = typeof inputOriginalMap === 'object' ? inputOriginalMap : JSON.parse(inputOriginalMap);

			/* We should only apply the input mappings if the input mapping isn't empty,
			 * since `generator.applySourceMap` has a really bad performance on big inputs.
			 */
			if (inputMap.mappings !== '') {
				const consumer = new sourceMap.SourceMapConsumer(inputMap);
				generator.applySourceMap(consumer);
			}

			if (!inputMap.sources || !inputMap.sourcesContent) continue;
			for (const i in inputMap.sources) {
				generator.setSourceContent(inputMap.sources[i], inputMap.sourcesContent[i]);
			}
		}
		file.sourceMapString = generator.toString();
	}

	private emit(file: OutputFile) {
		if (file.skipPush) return;
		let root: string;
		if ((<tsApi.TypeScript>this.project.typescript).convertCompilerOptionsFromJson !== undefined && this.project.options.out === undefined) {
			root = '';
		} else if (this.project.singleOutput) {
			root = file.original.gulp.base;
		} else if (this.project.options.outDir !== undefined && this.project.compiler instanceof ProjectCompiler) {
			root = file.original.gulp.cwd + '/';
		} else {
			root = '';
		}

		let base: string;
		if (this.project.options.outDir !== undefined && this.project.compiler instanceof ProjectCompiler) {
			base = path.resolve(file.original.gulp.cwd, this.project.options.outDir) + '/';
		} else if (this.project.singleOutput) {
			base = this.project.input.commonBasePath;
		} else {
			base = file.original.gulp.base;
		}

		const fileJs = <VinylFile> new gutil.File({
			path: path.join(root, file.fileName + '.' + file.extension[OutputFileKind.JavaScript]),
			contents: new Buffer(file.content[OutputFileKind.JavaScript]),
			cwd: file.original.gulp.cwd,
			base
		});
		if (file.original.gulp.sourceMap) fileJs.sourceMap = JSON.parse(file.sourceMapString);
		this.streamJs.push(fileJs);

		if (this.project.options.declaration) {
			const fileDts = new gutil.File({
				path: path.join(root, file.fileName + '.' + file.extension[OutputFileKind.Definitions]),
				contents: new Buffer(file.content[OutputFileKind.Definitions]),
				cwd: file.original.gulp.cwd,
				base
			});
			this.streamDts.push(fileDts);
		}
	}

	finish(results: reporter.CompilationResult) {
		if (this.project.sortOutput) {
			let sortedEmit = (fileName: string) => {
				let file = this.files[utils.normalizePath(fileName)];
				if (!file || file.skipPush || file.pushed) return;

				if (file.original && file.original.ts) {
					let references = file.original.ts.referencedFiles.map(file => tsApi.getFileName(file));

					for (const reference of references) {
						sortedEmit(utils.splitExtension(reference)[0]);
					}
				}
				this.emit(file);
			};

			for (const fileName of Object.keys(this.files)) {
				sortedEmit(fileName);
			}
		}

		this.results = results;
		if (this.project.reporter.finish) this.project.reporter.finish(results);

		this.streamJs.emit('finish');
		this.streamDts.emit('finish');
		this.streamJs.push(null);
		this.streamDts.push(null);
		this.project.running = false;
	}

	private getError(info: ts.Diagnostic): reporter.TypeScriptError {
		let fileName = info.file && tsApi.getFileName(info.file);
		const file = fileName && this.project.input.getFile(fileName);
		
		return utils.getError(info, this.project.typescript, file);
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
