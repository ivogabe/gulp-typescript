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

export class Output {
	constructor(_project: project.ProjectInfo, streamFull: stream.Readable, streamJs: stream.Readable, streamDts: stream.Readable) {
		this.project = _project;
		this.streamFull = streamFull;
		this.streamJs = streamJs;
		this.streamDts = streamDts;
	}

	project: project.ProjectInfo;
	result: reporter.CompilationResult;
	// .js and .d.ts files
	streamFull: stream.Readable;
	// .js files
	streamJs: stream.Readable;
	// .d.ts files
	streamDts: stream.Readable;

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
		const map = JSON.parse(sourceMapContent);
		const directory = path.dirname(output.path);
		
		// gulp-sourcemaps docs:
		// paths in the generated source map (`file` and `sources`) are relative to `file.base` (e.g. use `file.relative`).
		map.file = output.relative;
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
				generator.applySourceMap(consumer, sourceFile.fileNameOriginal, sourceFile.gulp.base);
			}

			if (!inputMap.sources || !inputMap.sourcesContent) continue;
			for (let i = 0; i < inputMap.sources.length; i++) {
				const absolute = path.resolve(sourceFile.gulp.base, inputMap.sources[i]);
				const relative = path.relative(directory, absolute);
				generator.setSourceContent(relative, inputMap.sourcesContent[i]);
			}
		}
		return generator.toString();

		function relativeToOutput(fileName: string) {
			const absolute = path.resolve(directory, fileName.replace(/\\/g, '/'));
			return path.relative(output.base, absolute);
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
	diagnostic(info: ts.Diagnostic) {
		this.error(this.getError(info));
	}
	error(error: reporter.TypeScriptError) {
		if (!error) return;

		// call reporter callback
		if (this.project.reporter.error) this.project.reporter.error(<reporter.TypeScriptError> error, this.project.typescript);
		// & emit the error on the stream.
		this.streamFull.emit('error', error);
	}
}
