import * as stream from 'stream';
import * as path from 'path';
import * as ts from 'typescript';
import * as sourceMap from 'source-map';
import * as gutil from 'gulp-util';
import * as utils from './utils';
import * as input from './input';
import * as reporter from './reporter';
import * as project from './project';
import { VinylFile, RawSourceMap } from './types';

/**
 * Converts a `ts.Diagnostic` object to a string identifying it.
 *
 * @param diagnostic Diagnostic object to hash
 * @return Hash the diagnostic object
 */
function hashDiagnostic(diagnostic: ts.Diagnostic): string {
	const plain = {
		fileName: diagnostic.file && diagnostic.file.fileName,
		start: diagnostic.start,
		length: diagnostic.length,
		messageText: diagnostic.messageText,
		category: diagnostic.category,
		code: diagnostic.code,
		source: diagnostic.source,
	};
	return JSON.stringify(plain);
}

export class Output {
	constructor(_project: project.ProjectInfo, streamFull: stream.Readable, streamJs: stream.Readable, streamDts: stream.Readable) {
		this.project = _project;
		this.streamFull = streamFull;
		this.streamJs = streamJs;
		this.streamDts = streamDts;
		this.diagnostics = {};
	}

	project: project.ProjectInfo;
	result: reporter.CompilationResult;
	// .js and .d.ts files
	streamFull: stream.Readable;
	// .js files
	streamJs: stream.Readable;
	// .d.ts files
	streamDts: stream.Readable;

	/**
	 * Set of hashes of reported diagnostics, used to detect duplicates.
	 */
	private diagnostics: {[diagnosticHash: string]: boolean};

	writeJs(base: string, fileName: string, content: string, sourceMapContent: string, cwd: string, original: input.File) {
		const file = <VinylFile> new gutil.File({
			path: fileName,
			contents: new Buffer(content),
			cwd,
			base
		});
		const appliedSourceMap = this.applySourceMap(sourceMapContent, original, file);
		if (appliedSourceMap) file.sourceMap = JSON.parse(appliedSourceMap);
		this.streamFull.push(file);
		this.streamJs.push(file);
	}

	writeDts(base: string, fileName: string, content: string, cwd: string) {
		const file = new gutil.File({
			path: fileName,
			contents: new Buffer(content),
			cwd,
			base
		});
		this.streamFull.push(file);
		this.streamDts.push(file);
	}

	private applySourceMap(sourceMapContent: string, original: input.File, output: VinylFile) {
		if (sourceMapContent === undefined) return undefined;

		const map = JSON.parse(sourceMapContent);
		const directory = path.dirname(output.path);

		// gulp-sourcemaps docs:
		// paths in the generated source map (`file` and `sources`) are relative to `file.base` (e.g. use `file.relative`).
		map.file = utils.forwardSlashes(output.relative);
		map.sources = map.sources.map(relativeToOutput);

		delete map.sourceRoot;

		const generator = sourceMap.SourceMapGenerator.fromSourceMap(new sourceMap.SourceMapConsumer(map));

		const sourceMapOrigins = this.project.singleOutput
			? this.project.input.getFileNames(true).map(fName => this.project.input.getFile(fName))
			: [original];


		for (const sourceFile of sourceMapOrigins) {
			if (!sourceFile || !sourceFile.gulp || !sourceFile.gulp.sourceMap) continue;

			const inputOriginalMap = sourceFile.gulp.sourceMap;
			const inputMap: RawSourceMap = typeof inputOriginalMap === 'object' ? inputOriginalMap : JSON.parse(inputOriginalMap);

			// We should only apply the input mappings if the input mapping isn't empty,
			// since `generator.applySourceMap` has a really bad performance on big inputs.
			if (inputMap.mappings !== '') {
				const consumer = new sourceMap.SourceMapConsumer(inputMap);
				generator.applySourceMap(consumer);
			}

			if (!inputMap.sources || !inputMap.sourcesContent) continue;
			for (let i = 0; i < inputMap.sources.length; i++) {
				const absolute = path.resolve(sourceFile.gulp.base, inputMap.sources[i]);
				const relative = path.relative(output.base, absolute);
				generator.setSourceContent(utils.forwardSlashes(relative), inputMap.sourcesContent[i]);
			}
		}
		return generator.toString();

		function relativeToOutput(fileName: string) {
			const absolute = path.resolve(directory, fileName);
			return utils.forwardSlashes(path.relative(output.base, absolute));
		}
	}

	finish(result: reporter.CompilationResult) {
		this.result = result;
		if (this.project.reporter.finish) this.project.reporter.finish(result);

		this.streamFull.emit('finish');
		this.streamJs.emit('finish');
		this.streamDts.emit('finish');
		this.streamFull.push(null);
		this.streamJs.push(null);
		this.streamDts.push(null);
	}

	private getError(info: ts.Diagnostic): reporter.TypeScriptError {
		let fileName = info.file && info.file.fileName;
		const file = fileName && this.project.input.getFile(fileName);

		return utils.getError(info, this.project.typescript, file);
	}

	/**
	 * Report a new diagnostic
	 *
	 * By default, it only reports unique diagnostics. You can disable this behavior
	 * by setting `skipUniqueCheck` to `true`.
	 *
	 * @param info Diagnostic to report.
	 * @param skipUniqueCheck Force reporting even if the diagnostic was already reported.
	 * @return Boolean indicating if the diagnostic was reported.
	 */
	diagnostic(info: ts.Diagnostic, skipUniqueCheck: boolean = false): boolean {
		const hash: string = hashDiagnostic(info);
		if (!skipUniqueCheck && hash in this.diagnostics) {
			return false;
		}
		this.diagnostics[hash] = true;
		this.error(this.getError(info));
		return true;
	}
	error(error: reporter.TypeScriptError) {
		if (!error) return;

		// call reporter callback
		if (this.project.reporter.error) this.project.reporter.error(<reporter.TypeScriptError> error, this.project.typescript);
		// & emit the error on the stream.
		this.streamFull.emit('error', error);
	}
}
