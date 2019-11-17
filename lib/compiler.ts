import * as ts from 'typescript';
import * as path from 'path';
import { RawSourceMap } from 'source-map';
import { File, FileChangeState } from './input';
import { Host } from './host';
import { ProjectInfo } from './project';
import { CompilationResult, emptyCompilationResult } from './reporter';
import { FinalTransformers } from './types';
import * as utils from './utils';

export interface ICompiler {
	prepare(project: ProjectInfo, finalTransformers?: FinalTransformers): void;
	inputFile(file: File): void;
	inputDone(): void;
}

interface OutputFile {
	file: File | undefined;

	jsFileName?: string;
	dtsFileName?: string;
	dtsMapFileName?: string;
	jsContent?: string;
	jsMapContent?: string;
	dtsContent?: string;
	dtsMapContent?: string;
}

/**
 * Compiles a whole project, with full type checking
 */
export class ProjectCompiler implements ICompiler {
	finalTransformers: FinalTransformers;
	host: Host;
	project: ProjectInfo;
	program: ts.BuilderProgram;
	private hasSourceMap: boolean;

	prepare(project: ProjectInfo, finalTransformers?: FinalTransformers) {
		this.finalTransformers = finalTransformers;
		this.project = project;
		this.hasSourceMap = false;
	}

	inputFile(file: File) {
		if (file.gulp.sourceMap) this.hasSourceMap = true;
	}

	inputDone() {
		if (!this.project.input.firstSourceFile) {
			this.project.output.finish(emptyCompilationResult(this.project.options.noEmit));
			return;
		}

		const rootFilenames: string[] = this.project.input.getFileNames(true);
		if (!this.project.singleOutput) {
			if (this.project.options.rootDir === undefined) {
				this.project.options.rootDir = utils.getCommonBasePathOfArray(
					rootFilenames.filter(fileName => fileName.substr(-5) !== ".d.ts")
						.map(fileName => this.project.input.getFile(fileName).gulp.base)
				);
			}
		}

		this.project.options.sourceMap = this.hasSourceMap;

		const currentDirectory = utils.getCommonBasePathOfArray(
			rootFilenames.map(fileName => this.project.input.getFile(fileName).gulp.cwd)
		);

		if (this.program === undefined) {
			this.host = new Host(
				this.project.typescript,
				currentDirectory,
				this.project.input,
				this.project.options
			);
			this.program = this.project.typescript.createIncrementalProgram({
				rootNames: rootFilenames,
				options: this.project.options,
				projectReferences: this.project.projectReferences,
				host: this.host,
				createProgram: this.project.typescript.createAbstractBuilder
			});
		}

		const result = emptyCompilationResult(this.project.options.noEmit);

		const optionErrors = this.program.getOptionsDiagnostics();
		const syntaxErrors = this.program.getSyntacticDiagnostics();
		const globalErrors = this.program.getGlobalDiagnostics();
		const semanticErrors = this.program.getSemanticDiagnostics();

		result.optionsErrors = optionErrors.length;
		result.syntaxErrors = syntaxErrors.length;
		result.globalErrors = globalErrors.length;
		result.semanticErrors = semanticErrors.length;

		let declarationErrors: ReadonlyArray<ts.DiagnosticWithLocation> = [];
		if (this.project.options.declaration) {
			declarationErrors = this.program.getDeclarationDiagnostics();
			result.declarationErrors = declarationErrors.length;
		}

		const preEmitDiagnostics: ReadonlyArray<ts.DiagnosticWithLocation> = [...optionErrors, ...syntaxErrors, ...globalErrors, ...semanticErrors, ...declarationErrors];

		if (this.project.singleOutput) {
			const output: OutputFile = {
				file: undefined
			};

			this.emit(result, preEmitDiagnostics, (fileName, content) => {
				this.attachContentToFile(output, fileName, content);
			});

			this.emitFile(output, currentDirectory);
		} else {
			const output: utils.Map<OutputFile> = {};

			const input = this.host.input.getFileNames(true);

			for (let i = 0; i < input.length; i++) {
				const fileName = this.host.getCanonicalFileName(input[i]);
				const file = this.project.input.getFile(fileName);

				output[fileName] = { file };
			}

			this.emit(result, preEmitDiagnostics, (fileName, content, writeByteOrderMark, onError, sourceFiles) => {
				if (sourceFiles === undefined) return; // .tsbuildinfo file, ignore
				if (sourceFiles.length !== 1) {
					throw new Error("Failure: sourceFiles in WriteFileCallback should have length 1, got " + sourceFiles.length);
				}

				const fileNameOriginal = this.host.getCanonicalFileName(sourceFiles[0].fileName);
				const file = output[fileNameOriginal];
				if (!file) return;

				this.attachContentToFile(file, fileName, content);
			});

			for (let i = 0; i < input.length; i++) {
				const fileName = this.host.getCanonicalFileName(input[i]);
				this.emitFile(output[fileName], currentDirectory);
			}
		}

		this.project.output.finish(result);
	}

	private attachContentToFile(file: OutputFile, fileName: string, content: string) {
		const [, extension] = utils.splitExtension(fileName, ['d.ts', 'd.ts.map']);
		switch (extension) {
			case 'js':
			case 'jsx':
				file.jsFileName = fileName;
				file.jsContent = content;
				break;
			case 'd.ts.map':
				file.dtsMapFileName = fileName;
				file.dtsMapContent = content;
				break;
			case 'd.ts':
				file.dtsFileName = fileName;
				file.dtsContent = content;
				break;
			case 'map':
				file.jsMapContent = content;
				break;
		}
	}
	private emit(result: CompilationResult, preEmitDiagnostics: ReadonlyArray<ts.DiagnosticWithLocation>, callback: ts.WriteFileCallback) {
		const emitOutput = this.program.emit(
			undefined,
			callback,
			undefined,
			false,
			this.finalTransformers ? this.finalTransformers(this.program.getProgram()) : undefined,
		);
		result.emitSkipped = emitOutput.emitSkipped;

		// `emitOutput.diagnostics` might contain diagnostics that were already part of `preEmitDiagnostics`.
		// See https://github.com/Microsoft/TypeScript/issues/20876
		// We use sortAndDeduplicateDiagnostics to remove duplicate diagnostics.
		// We then count the number of diagnostics in `diagnostics` that we not in `preEmitDiagnostics`
		// to count the number of emit diagnostics.
		const diagnostics = ts.sortAndDeduplicateDiagnostics([...preEmitDiagnostics, ...emitOutput.diagnostics]);
		result.emitErrors += diagnostics.length - preEmitDiagnostics.length;

		for (const error of diagnostics) {
			this.project.output.diagnostic(error);
		}
	}
	private emitFile({ file, jsFileName, dtsFileName, dtsMapFileName, jsContent, dtsContent, dtsMapContent, jsMapContent }: OutputFile, currentDirectory: string) {
		let base: string;
		let baseDeclarations: string;
		if (file) {
			base = file.gulp.base;
			if (this.project.options.outDir) {
				const baseRelative = path.relative(this.project.options.rootDir, base);
				base = path.join(this.project.options.outDir, baseRelative);
			}
			baseDeclarations = base;
			if (this.project.options.declarationDir) {
				const baseRelative = path.relative(this.project.options.rootDir, file.gulp.base);
				baseDeclarations = path.join(this.project.options.declarationDir, baseRelative);
			}
		} else if (this.project.options.outFile) {
			base = this.project.directory;
			baseDeclarations = base;
		} else {
			base = this.project.directory;
			baseDeclarations = base;
			if (jsFileName !== undefined) {
				jsFileName = path.resolve(base, jsFileName);
			}
			if (dtsFileName !== undefined) {
				dtsFileName = path.resolve(base, dtsFileName);
			}
		}

		if (jsContent !== undefined) {
			if (jsMapContent !== undefined) {
				jsContent = this.removeSourceMapComment(jsContent);
			}
			this.project.output.writeJs(base, jsFileName, jsContent, jsMapContent, file ? file.gulp.cwd : currentDirectory, file);
		}
		if (dtsContent !== undefined) {
			if (dtsMapContent !== undefined) {
				dtsContent = this.removeSourceMapComment(dtsContent);
			}
			this.project.output.writeDts(baseDeclarations, dtsFileName, dtsContent, dtsMapContent, file ? file.gulp.cwd : currentDirectory, file);
		}
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

interface FileResult {
	fileName: string;
	diagnostics: ts.Diagnostic[];
	content: string;
	sourceMap: string;
}
export class FileCompiler implements ICompiler {
	finalTransformers: FinalTransformers;
	host: Host;
	project: ProjectInfo;

	private output: utils.Map<FileResult> = {};
	private previousOutput: utils.Map<FileResult> = {};

	private compilationResult: CompilationResult = undefined;

	prepare(project: ProjectInfo, finalTransformers: FinalTransformers) {
		this.finalTransformers = finalTransformers;
		this.project = project;
		this.project.input.noParse = true;
		this.compilationResult = emptyCompilationResult(this.project.options.noEmit);
	}

	private write(file: File, fileName: string, diagnostics: ts.Diagnostic[], content: string, sourceMap: string) {
		this.output[file.fileNameNormalized] = { fileName, diagnostics, content, sourceMap };

		for (const error of diagnostics) {
			this.project.output.diagnostic(error);
		}
		this.compilationResult.transpileErrors += diagnostics.length;

		this.project.output.writeJs(file.gulp.base, fileName, content, sourceMap, file.gulp.cwd, file);
	}

	inputFile(file: File) {
		if (file.fileNameNormalized.substr(file.fileNameNormalized.length - 5) === '.d.ts') {
			return; // Don't compile definition files
		}

		if (this.project.input.getFileChange(file.fileNameOriginal).state === FileChangeState.Equal) {
			// Not changed, re-use old file.

			const old = this.previousOutput[file.fileNameNormalized];
			this.write(file, old.fileName, old.diagnostics, old.content, old.sourceMap);

			return;
		}

		const output: ts.TranspileOutput = this.project.typescript.transpileModule(file.content, {
			compilerOptions: this.project.options,
			fileName: file.fileNameOriginal,
			reportDiagnostics: true,
			transformers: this.finalTransformers ? this.finalTransformers() : undefined,
		});

		const outputString = output.outputText;
		let index = outputString.lastIndexOf('\n');
		let mapString = outputString.substring(index + 1);
		if (mapString.substring(0, 1) === '\r') mapString = mapString.substring(1);

		const start = '//# sourceMappingURL=data:application/json;base64,';
		if (mapString.substring(0, start.length) !== start) {
			console.log('Couldn\'t read the sourceMap generated by TypeScript. This is likely an issue with gulp-typescript.');
			return;
		}

		mapString = mapString.substring(start.length);

		let map: RawSourceMap = JSON.parse(Buffer.from(mapString, 'base64').toString());
		// TODO: Set paths correctly
		// map.sourceRoot = path.resolve(file.gulp.cwd, file.gulp.base);
		// map.sources[0] = path.relative(map.sourceRoot, file.gulp.path);

		const [fileNameExtensionless] = utils.splitExtension(file.fileNameOriginal);
		const [, extension] = utils.splitExtension(map.file); // js or jsx

		this.write(file, fileNameExtensionless + '.' + extension, output.diagnostics, outputString.substring(0, index), JSON.stringify(map));
	}

	inputDone() {
		this.project.output.finish(this.compilationResult);

		this.previousOutput = this.output;
		this.output = {};
	}
}
