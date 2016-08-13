import * as stream from 'stream';
import * as ts from 'typescript';
import * as sourceMap from 'source-map';
import * as gutil from 'gulp-util';
import * as utils from './utils';
import * as input from './input';
import * as reporter from './reporter';
import * as project from './project';
import { VinylFile, RawSourceMap } from './types';

export class Output {
	constructor(_project: project.ProjectInfo, streamJs: stream.Readable, streamDts: stream.Readable) {
		this.project = _project;
		this.streamJs = streamJs;
		this.streamDts = streamDts;
	}

	project: project.ProjectInfo;
	result: reporter.CompilationResult;
	streamJs: stream.Readable;
	streamDts: stream.Readable;

	writeJs(base: string, fileName: string, content: string, sourceMapContent: string, original: input.File) {
		const appliedSourceMap = this.applySourceMap(sourceMapContent, original);
		
		const file = <VinylFile> new gutil.File({
			path: fileName,
			contents: new Buffer(content),
			cwd: original.gulp.cwd,
			base
		});
		if (appliedSourceMap) file.sourceMap = JSON.parse(appliedSourceMap);
		this.streamJs.push(file);
	}

	writeDts(base: string, fileName: string, content: string, original: input.File) {
		const file = new gutil.File({
			path: fileName,
			contents: new Buffer(content),
			cwd: original.gulp.cwd,
			base
		});
		this.streamDts.push(file);
	}

	private applySourceMap(sourceMapContent: string, original: input.File) {
		if (!original.gulp.sourceMap) return;

		const map = JSON.parse(sourceMapContent);
		map.file = map.file.replace(/\\/g, '/');
		delete map.sourceRoot;
		map.sources = map.sources.map(path => path.replace(/\\/g, '/'));

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
				generator.setSourceContent(inputMap.sources[i], inputMap.sourcesContent[i]);
			}
		}
		return generator.toString();
	}

	finish(result: reporter.CompilationResult) {
		this.result = result;
		if (this.project.reporter.finish) this.project.reporter.finish(result);

		this.streamJs.emit('finish');
		this.streamDts.emit('finish');
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
		this.streamJs.emit('error', error);
	}
}
