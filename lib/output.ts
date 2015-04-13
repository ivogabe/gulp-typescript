///<reference path='../definitions/ref.d.ts'/>
import stream = require('stream');
import path = require('path');
import gutil = require('gulp-util');
import file = require('./file');

export interface OutputFile {
	fileName: string;
	original: file.File;
}
export interface OutputJsFile extends OutputFile {
	contentJs: string;
	contentMap: string;
}
export interface OutputDtsFile extends OutputFile {
	contentDts: string;
}

export class Output {
	filesJs: OutputJsFile[] = [];
	filesDts: OutputDtsFile[] = [];
	streamJs: stream.Readable;
	streamDts: stream.Readable;

	write(fileName: string, content: string, original: file.File) {
		switch (path.extname(fileName).toLowerCase()) {
			case 'js':
				this.addOrMergeJsOrMap({
					fileName,
					original,
					contentJs: content,
					contentMap: undefined
				});
				break;
			case 'map':
				this.addOrMergeJsOrMap({
					fileName: undefined,
					original,
					contentJs: undefined,
					contentMap: content
				});
				break;
			case 'ts': // .d.ts
				this.pushDts({
					fileName,
					original,
					contentDts: content
				});
				break;
		}
	}

	private addOrMergeJsOrMap(newFile: OutputJsFile) {
		for (const item of this.filesJs) {
			if (item.original !== newFile.original) continue;

			if (item.contentJs !== undefined && item.contentMap !== undefined) {
				// This file has already js & map content.
				throw new Error('Assert failed: same file is emited twice by the compiler.');
			}

			if (newFile.fileName !== undefined) item.fileName = newFile.fileName;
			if (newFile.contentJs !== undefined) item.contentJs = newFile.contentJs;
			if (newFile.contentMap !== undefined) item.contentMap = newFile.contentMap;

			if (item.contentJs === undefined || item.contentMap === undefined) {
				// This file should be complete now, but it isn't.
				throw new Error('Assert failed: file should be complete, but js or sourcemap content not found.');
			}

			this.pushJs(item);
		}
	}

	private pushJs(item: OutputJsFile) {
		this.filesJs.push(item);

		const gFile = new gutil.File({
			path: item.fileName,
			contents: new Buffer(item.contentJs),
			cwd: item.original.gulp.cwd,
			base: item.original.gulp.base
		});

		// TODO: SourceMap

		this.streamJs.push(gFile);
	}

	private pushDts(item: OutputDtsFile) {
		this.filesDts.push(item);

		const gFile = new gutil.File({
			path: item.fileName,
			contents: new Buffer(item.contentDts),
			cwd: item.original.gulp.cwd,
			base: item.original.gulp.base
		});

		this.streamDts.push(gFile);
	}

	finish() {
		this.streamJs.push(null);
		this.streamDts.push(null);
	}
}
