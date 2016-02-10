import * as ts from 'typescript';
import * as path from 'path';
import * as gutil from 'gulp-util';
import { RawSourceMap } from 'source-map';
import * as tsApi from './tsapi';
import { File, FileChangeState } from './input';
import { Output, OutputFileKind } from './output';
import { Host } from './host';
import { Project } from './project';
import { Filter } from './filter';
import { CompilationResult, emptyCompilationResult } from './reporter';
import * as utils from './utils';

export interface ICompiler {
	prepare(_project: Project): void;
	inputFile(file: File);
	inputDone();
	/**
	 * Corrects the paths in the sourcemap.
	 * Returns true when the file is located
	 * under the base path.
	 */
	correctSourceMap(map: RawSourceMap): boolean;
}

/**
 * Compiles a whole project, with full type checking
 */
export class ProjectCompiler implements ICompiler {
	host: Host;
	project: Project;
	program: ts.Program;

	prepare(_project: Project) {
		this.project = _project;
	}

	inputFile(file: File) { }

	inputDone() {
		if (!this.project.input.firstSourceFile) {
			this.project.output.finish(emptyCompilationResult());
			return;
		}

		if (!this.project.input.isChanged(true)) {
			// Re-use old output
			const old = this.project.previousOutput;

			for (const error of old.errors) {
				this.project.output.error(error);
			}

			for (const fileName of Object.keys(old.files)) {
				const file = old.files[fileName];
				this.project.output.write(file.fileName + '.' + file.extension[OutputFileKind.JavaScript], file.content[OutputFileKind.JavaScript]);
				this.project.output.write(file.fileName + '.' + file.extension[OutputFileKind.SourceMap], file.content[OutputFileKind.SourceMap]);
				if (file.content[OutputFileKind.Definitions] !== undefined) {
					this.project.output.write(file.fileName + '.' + file.extension[OutputFileKind.Definitions], file.content[OutputFileKind.Definitions]);
				}
			}
			
			this.project.output.finish(old.results);

			return;
		}
		
		let root = this.project.input.commonBasePath;
		this.project.options.sourceRoot = root;
		
		this.host = new Host(
			this.project.typescript,
			this.project.currentDirectory,
			this.project.input,
			!this.project.noExternalResolve,
			this.project.options.target >= ts.ScriptTarget.ES6 ? 'lib.es6.d.ts' : 'lib.d.ts',
			this.project.useCaseSensitiveFileNames
		);

		let rootFilenames: string[] = this.project.input.getFileNames(true);

		if (this.project.filterSettings !== undefined) {
			let filter = new Filter(this.project, this.project.filterSettings);
			rootFilenames = rootFilenames.filter((fileName) => filter.match(fileName));
		}
		
		if (!this.project.singleOutput) {
			// Add an empty file under the root.
			// This will make sure the commonSourceDirectory, calculated by TypeScript, won't point to a subdirectory of the root.
			// We cannot use the `rootDir` option here, since that gives errors if the commonSourceDirectory points to a
			// directory containing the rootDir instead of the rootDir, which will break the build when using `noEmitOnError`.
			// The empty file is filtered out later on.
			let emptyFileName = path.join(root, '________________empty.ts')
			rootFilenames.push(emptyFileName);
			this.project.input.addContent(emptyFileName, '');
		}

		// Creating a program to compile the sources
		// We cast to `tsApi.CreateProgram` so we can pass the old program as an extra argument.
		// TS 1.6+ will try to reuse program structure (if possible)
		this.program = (<tsApi.CreateProgram> this.project.typescript.createProgram)(rootFilenames, this.project.options, this.host, this.program);

		const [errors, result] = tsApi.getDiagnosticsAndEmit(this.program);

		for (let i = 0; i < errors.length; i++) {
			this.project.output.diagnostic(errors[i]);
		}

		for (const fileName in this.host.output) {
			if (!this.host.output.hasOwnProperty(fileName)) continue;
			
			let content = this.host.output[fileName]
			const [, extension] = utils.splitExtension(fileName);
			if (extension === 'js' || extension === 'jsx') {
				content = this.removeSourceMapComment(content);
			}

			this.project.output.write(fileName, content);
		}

		this.project.output.finish(result);
	}
	
	private _commonBaseDiff: [number, string];
	/**
	 * Calculates the difference between the common base directory calculated based on the base paths of the input files
	 * and the common source directory calculated by TypeScript.
	 */
	private get commonBaseDiff(): [number, string] {
		if (this._commonBaseDiff) return this._commonBaseDiff;
		
		const expected = this.project.input.commonBasePath;
		const real = this.project.input.commonSourceDirectory;
		
		const length = real.length - expected.length;
		
		this._commonBaseDiff = [length, real.substring(real.length - length)]
		
		if (length > 0) {
			this._commonBaseDiff = [length, real.substring(real.length - length)];
		} else {
			this._commonBaseDiff = [length, expected.substring(expected.length + length)];
		}
		
		if (this._commonBaseDiff[1] === '/' || this._commonBaseDiff[1] === '\\') {
			this._commonBaseDiff = [0, ''];
		}
		
		return this._commonBaseDiff;
	}
	
	correctSourceMap(map: RawSourceMap) {
		const [diffLength, diff] = this.commonBaseDiff;
		
		if (this.project.singleOutput) return true;
		
		if (diffLength < 0) {
			// There were files added outside of the common base.
			let outsideRoot = false;
			map.sources = map.sources.map<string>(fileName => {
				const full = utils.normalizePath(path.join(this.project.input.commonSourceDirectory, fileName));
				let relative = path.relative(utils.normalizePath(this.project.input.commonBasePath), full);
				
				const first2 = relative.substring(0, 2);
				const first3 = relative.substring(0, 3);
				if (first3 === '../' || first3 === '..\\') {
					outsideRoot = true;
				} else if (first2 === './' || first2 === '.\\') {
					relative = relative.substring(2);
				}
				return full.substring(full.length - relative.length);
			});
			
			if (outsideRoot) return false;
		}
		
		return true;
	}
	
	private removeSourceMapComment(content: string): string {
		// By default the TypeScript automaticly inserts a source map comment.
		// This should be removed because gulp-sourcemaps takes care of that.
		// The comment is always on the last line, so it's easy to remove it
		// (But the last line also ends with a \n, so we need to look for the \n before the other)
		const index = content.lastIndexOf('\n', content.length - 2);
		return content.substring(0, index) + '\n';
	}
}

export class FileCompiler implements ICompiler {
	host: Host;
	project: Project;
	program: ts.Program;
	
	private errorsPerFile: utils.Map<ts.Diagnostic[]> = {};
	private previousErrorsPerFile: utils.Map<ts.Diagnostic[]> = {};
	private compilationResult: CompilationResult = undefined;
	
	prepare(_project: Project) {
		this.project = _project;
		this.project.input.noParse = true;
		this.compilationResult = emptyCompilationResult();
	}

	inputFile(file: File) {
		if (file.fileNameNormalized.substr(file.fileNameNormalized.length - 5) === '.d.ts') {
			return; // Don't compile definition files
		}
		
		if (this.project.input.getFileChange(file.fileNameOriginal).state === FileChangeState.Equal) {
			// Not changed, re-use old file.
			
			const old = this.project.previousOutput;

			const diagnostics = this.previousErrorsPerFile[file.fileNameNormalized]
			for (const error of diagnostics) {
				this.project.output.diagnostic(error);
			}
			this.compilationResult.transpileErrors += diagnostics.length;
			this.errorsPerFile[file.fileNameNormalized] = this.previousErrorsPerFile[file.fileNameNormalized];

			for (const fileName of Object.keys(old.files)) {
				const oldFile = old.files[fileName];
				if (oldFile.original.fileNameNormalized !== file.fileNameNormalized) continue;
				
				this.project.output.write(oldFile.fileName + '.' + oldFile.extension[OutputFileKind.JavaScript], oldFile.content[OutputFileKind.JavaScript]);
				this.project.output.write(oldFile.fileName + '.' + oldFile.extension[OutputFileKind.SourceMap], oldFile.content[OutputFileKind.SourceMap]);
			}

			return;
		}
		
		const diagnostics: ts.Diagnostic[] = [];
		const outputString = tsApi.transpile(
			this.project.typescript,
			file.content,
			this.project.options,
			file.fileNameOriginal,
			diagnostics
		);
		for (const diagnostic of diagnostics) {
			this.project.output.diagnostic(diagnostic);
		}
		this.compilationResult.transpileErrors += diagnostics.length;
		
		let index = outputString.lastIndexOf('\n')
		let mapString = outputString.substring(index + 1);
		if (mapString.substring(0, 1) === '\r') mapString = mapString.substring(1);
		
		const start = '//# sourceMappingURL=data:application/json;base64,';
		if (mapString.substring(0, start.length) !== start) {
			console.error('Couldn\'t read the sourceMap generated by TypeScript. This is likely an issue with gulp-typescript.');
			return;
		}
		
		mapString = mapString.substring(start.length);
		
		let map: RawSourceMap = JSON.parse(new Buffer(mapString, 'base64').toString());
		map.sourceRoot = path.resolve(file.gulp.cwd, file.gulp.base)
		map.sources[0] = path.relative(map.sourceRoot, file.gulp.path);
		
		const [fileNameExtensionless] = utils.splitExtension(file.fileNameOriginal);
		const [, extension] = utils.splitExtension(map.file); // js or jsx
		
		this.project.output.write(fileNameExtensionless + '.' + extension, outputString.substring(0, index));
		this.project.output.write(fileNameExtensionless + '.' + extension + '.map', JSON.stringify(map));
		
		this.errorsPerFile[file.fileNameNormalized] = diagnostics;
	}

	inputDone() {
		this.project.output.finish(this.compilationResult);
		
		this.previousErrorsPerFile = this.errorsPerFile;
		this.errorsPerFile = {};
	}
	
	correctSourceMap(map: RawSourceMap) {
		return true;
	}
}
