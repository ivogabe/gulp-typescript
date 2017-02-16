import * as ts from 'typescript';
import * as path from 'path';
import { RawSourceMap } from './types';
import { File, FileChangeState } from './input';
import { Host } from './host';
import { ProjectInfo } from './project';
import { CompilationResult, emptyCompilationResult } from './reporter';
import * as utils from './utils';

export interface ICompiler {
	prepare(project: ProjectInfo): void;
	inputFile(file: File): void;
	inputDone(): void;
}

/**
 * Compiles a whole project, with full type checking
 */
export class ProjectCompiler implements ICompiler {
	host: Host;
	project: ProjectInfo;
	program: ts.Program;
	private hasSourceMap: boolean;

	prepare(project: ProjectInfo) {
		this.project = project;
		this.hasSourceMap = false;
	}

	inputFile(file: File) {
		if (file.gulp.sourceMap) this.hasSourceMap = true;
	}

	inputDone() {
		if (!this.project.input.firstSourceFile) {
			this.project.output.finish(emptyCompilationResult());
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

		this.host = new Host(
			this.project.typescript,
			currentDirectory,
			this.project.input,
			this.project.options
		);

		this.program = this.project.typescript.createProgram(rootFilenames, this.project.options, this.host, this.program);
		const preEmitDiagnostics = this.project.typescript.getPreEmitDiagnostics(this.program);
		
		const result = emptyCompilationResult();
		result.optionsErrors = this.program.getOptionsDiagnostics().length;
		result.syntaxErrors = this.program.getSyntacticDiagnostics().length;
		result.globalErrors = this.program.getGlobalDiagnostics().length;
		result.semanticErrors = this.program.getSemanticDiagnostics().length;
		if (this.project.options.declaration) {
			result.declarationErrors = this.program.getDeclarationDiagnostics().length;
		}

		this.reportDiagnostics(preEmitDiagnostics);

		const emitOutput = this.program.emit();
		result.emitErrors = emitOutput.diagnostics.length;
		result.emitSkipped = emitOutput.emitSkipped;

		if (this.project.singleOutput) {
			this.emitFile(result, currentDirectory);
		} else {
			// Emit files one by one
			for (const fileName of this.host.input.getFileNames(true)) {
				const file = this.project.input.getFile(fileName);

				this.emitFile(result, currentDirectory, file);
			}
		}

		this.project.output.finish(result);
	}

	private emitFile(result: CompilationResult, currentDirectory: string, file?: File) {
		let jsFileName: string;
		let dtsFileName: string;
		let jsContent: string;
		let dtsContent: string;
		let jsMapContent: string;

		const emitOutput = this.program.emit(file && file.ts, (fileName: string, content: string) => {
			const [, extension] = utils.splitExtension(fileName, ['d.ts']);
			switch (extension) {
				case 'js':
				case 'jsx':
					jsFileName = fileName;
					jsContent = content;
					break;
				case 'd.ts':
					dtsFileName = fileName;
					dtsContent = content;
					break;
				case 'map':
					jsMapContent = content;
					break;
			}
		});

		result.emitErrors += emitOutput.diagnostics.length;
		this.reportDiagnostics(emitOutput.diagnostics);

		if (emitOutput.emitSkipped) {
			result.emitSkipped = true;
		}

		if (!jsFileName) return;

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
			const outFile = this.project.options.out;
			base = jsFileName.substring(0, jsFileName.length - outFile.length);
			baseDeclarations = base;
		}

		if (jsContent !== undefined) {
			if (jsMapContent !== undefined) {
				jsContent = this.removeSourceMapComment(jsContent);
			}
			this.project.output.writeJs(base, jsFileName, jsContent, jsMapContent, file ? file.gulp.cwd : currentDirectory, file);
		}
		if (dtsContent !== undefined) {
			this.project.output.writeDts(baseDeclarations, dtsFileName, dtsContent, file ? file.gulp.cwd : currentDirectory);
		}
	}

	private reportDiagnostics(diagnostics: ts.Diagnostic[]) {
		for (const error of diagnostics) {
			this.project.output.diagnostic(error);
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
	host: Host;
	project: ProjectInfo;

	private output: utils.Map<FileResult> = {};
	private previousOutput: utils.Map<FileResult> = {};

	private compilationResult: CompilationResult = undefined;
	
	prepare(project: ProjectInfo) {
		this.project = project;
		this.project.input.noParse = true;
		this.compilationResult = emptyCompilationResult();
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
		
		const diagnostics: ts.Diagnostic[] = [];
		const outputString = this.project.typescript.transpile(
			file.content,
			this.project.options,
			file.fileNameOriginal,
			diagnostics
		);
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
		// TODO: Set paths correctly
		// map.sourceRoot = path.resolve(file.gulp.cwd, file.gulp.base);
		// map.sources[0] = path.relative(map.sourceRoot, file.gulp.path);
		
		const [fileNameExtensionless] = utils.splitExtension(file.fileNameOriginal);
		const [, extension] = utils.splitExtension(map.file); // js or jsx
		
		this.write(file, fileNameExtensionless + '.' + extension, diagnostics, outputString.substring(0, index), JSON.stringify(map));
	}

	inputDone() {
		this.project.output.finish(this.compilationResult);
		
		this.previousOutput = this.output;
		this.output = {};
	}
}
