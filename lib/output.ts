import * as stream from 'stream';
import * as path from 'path';
import * as ts from 'typescript';
import * as sourceMap from 'source-map';
import * as VinylFile from 'vinyl';
import * as utils from './utils';
import * as input from './input';
import * as reporter from './reporter';
import * as project from './project';

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

	// Number of pending IO operatrions
	private pendingIO = 0;

	writeJs(base: string, fileName: string, content: string, sourceMapContent: string, cwd: string, original: input.File) {
		this.pipeRejection(this.writeJsAsync(base, fileName, content, sourceMapContent, cwd, original), this.streamJs);
	}

	private async writeJsAsync(base: string, fileName: string, content: string, sourceMapContent: string, cwd: string, original: input.File) {
		const file = new VinylFile({
			path: fileName,
			contents: Buffer.from(content),
			cwd,
			base
		});

		this.pendingIO++;

		await this.applySourceMap(sourceMapContent, original, file).then(appliedSourceMap => {
			if (appliedSourceMap) file.sourceMap = JSON.parse(appliedSourceMap);
			this.streamFull.push(file);
			this.streamJs.push(file);

			this.pendingIO--;
			this.mightFinish();
		});
	}

	writeDts(base: string, fileName: string, content: string, declarationMapContent: string, cwd: string, original: input.File) {
		this.pipeRejection(this.writeDtsAsync(base, fileName, content, declarationMapContent, cwd, original), this.streamDts);
	}

	private async writeDtsAsync(base: string, fileName: string, content: string, declarationMapContent: string, cwd: string, original: input.File) {
		const file = new VinylFile({
			path: fileName,
			contents: Buffer.from(content),
			cwd,
			base
		});

		this.pendingIO++;

		await this.applySourceMap(declarationMapContent, original, file).then(appliedSourceMap => {
			if (appliedSourceMap) file.sourceMap = JSON.parse(appliedSourceMap);
			this.streamFull.push(file);
			this.streamDts.push(file);

			this.pendingIO--;
			this.mightFinish();
		});
	}

	private async applySourceMap(sourceMapContent: string, original: input.File, output: VinylFile) {
		if (sourceMapContent === undefined) return undefined;

		const map = JSON.parse(sourceMapContent);
		const directory = path.dirname(output.path);

		// gulp-sourcemaps docs:
		// paths in the generated source map (`file` and `sources`) are relative to `file.base` (e.g. use `file.relative`).
		map.file = utils.forwardSlashes(output.relative);
		map.sources = map.sources.map(relativeToOutput);

		delete map.sourceRoot;

		const consumer = await new sourceMap.SourceMapConsumer(map);
		const generator = sourceMap.SourceMapGenerator.fromSourceMap(consumer);

		const sourceMapOrigins = this.project.singleOutput
			? this.project.input.getFileNames(true).map(fName => this.project.input.getFile(fName))
			: [original];

		for (const sourceFile of sourceMapOrigins) {
			if (!sourceFile || !sourceFile.gulp || !sourceFile.gulp.sourceMap) continue;

			const inputOriginalMap = sourceFile.gulp.sourceMap;
			const inputMap: sourceMap.RawSourceMap = typeof inputOriginalMap === 'object' ? inputOriginalMap : JSON.parse(inputOriginalMap);

			// We should only apply the input mappings if the input mapping isn't empty,
			// since `generator.applySourceMap` has a really bad performance on big inputs.
			if (inputMap.mappings !== '') {
				const inputConsumer = await new sourceMap.SourceMapConsumer(inputMap);
				generator.applySourceMap(inputConsumer);
				inputConsumer.destroy();
			}

			if (!inputMap.sources || !inputMap.sourcesContent) continue;
			for (let i = 0; i < inputMap.sources.length; i++) {
				const absolute = path.resolve(sourceFile.gulp.base, inputMap.sources[i]);
				const relative = path.relative(output.base, absolute);
				generator.setSourceContent(utils.forwardSlashes(relative), inputMap.sourcesContent[i]);
			}
		}
		consumer.destroy();
		return generator.toString();

		function relativeToOutput(fileName: string) {
			const absolute = path.resolve(directory, fileName);
			return utils.forwardSlashes(path.relative(output.base, absolute));
		}
	}

	// Avoids UnhandledPromiseRejectionWarning in NodeJS
	private pipeRejection<T>(promise: Promise<T>, alternateStream: stream.Readable) {
		promise.catch(err => {
			this.streamFull.emit("error", err);
			alternateStream.emit("error", err);
		});
	}

	finish(result: reporter.CompilationResult) {
		this.result = result;

		this.mightFinish();
	}

	private mightFinish() {
		if (this.result === undefined || this.pendingIO !== 0) return;

		if (this.project.reporter.finish) this.project.reporter.finish(this.result);

		if (reporter.countErrors(this.result) !== 0) {
			this.streamFull.emit('error', new Error("TypeScript: Compilation failed"));
		}

		this.streamFull.emit('finish');
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
	}
}
