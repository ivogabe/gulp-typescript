import * as stream from 'stream';
import * as ts from 'typescript';
import * as vfs from 'vinyl-fs';
import * as path from 'path';
import * as PluginError from 'plugin-error';
import * as VinylFile from 'vinyl';
import * as utils from './utils';
import { Reporter, defaultReporter } from './reporter';
import { FileCache } from './input';
import { Output } from './output';
import { ICompiler, ProjectCompiler, FileCompiler } from './compiler';
import { FinalTransformers, TsConfig } from './types';

interface PartialProject {
	(reporter?: Reporter): ICompileStream;

	src?(this: Project): NodeJS.ReadWriteStream;

	typescript?: typeof ts;
	projectDirectory?: string;
	configFileName?: string;
	rawConfig?: any;
	config?: TsConfig;
	options?: ts.CompilerOptions;
	projectReferences?: ReadonlyArray<ts.ProjectReference>;
}
export interface Project {
	(reporter?: Reporter): ICompileStream;

	src(this: Project): NodeJS.ReadWriteStream;

	readonly typescript?: typeof ts;
	readonly projectDirectory: string;
	readonly configFileName: string;
	readonly rawConfig: any;
	readonly config: TsConfig;
	readonly options: ts.CompilerOptions;
	readonly projectReferences: ReadonlyArray<ts.ProjectReference> | undefined;
}

export interface ProjectInfo {
	input: FileCache;
	output: Output;
	compiler: ICompiler;
	singleOutput: boolean;
	options: ts.CompilerOptions;
	projectReferences: ReadonlyArray<ts.ProjectReference>;
	typescript: typeof ts;
	directory: string;
	reporter: Reporter;
}

export function setupProject(projectDirectory: string, configFileName: string, rawConfig: any, config: TsConfig, options: ts.CompilerOptions, projectReferences: ReadonlyArray<ts.ProjectReference>, typescript: typeof ts, finalTransformers: FinalTransformers) {
	const caseSensitive = typescript.createCompilerHost(options).useCaseSensitiveFileNames();
	const input = new FileCache(typescript, options, caseSensitive);
	const compiler: ICompiler = options.isolatedModules ? new FileCompiler() : new ProjectCompiler();
	let running = false;

	if (options.isolatedModules) {
		options.newLine = typescript.NewLineKind.LineFeed;
		options.sourceMap = false;
		options.declaration = false;
		options.inlineSourceMap = true;
	}

	const project: PartialProject = (reporter) => {
		if (running) {
			throw new Error('gulp-typescript: A project cannot be used in two compilations at the same time. Create multiple projects with createProject instead.');
		}
		running = true;

		input.reset();
		compiler.prepare(projectInfo, finalTransformers);

		const stream = new CompileStream(projectInfo);
		projectInfo.output = new Output(projectInfo, stream, stream.js, stream.dts);
		projectInfo.reporter = reporter || defaultReporter();

		stream.on('finish', () => {
			running = false;
		});

		return stream;
	};

	const singleOutput = options.out !== undefined || options.outFile !== undefined;

	project.src = src;
	project.typescript = typescript;
	project.projectDirectory = projectDirectory;
	project.configFileName = configFileName;
	project.rawConfig = rawConfig;
	project.config = config;
	project.options = options;
	project.projectReferences = projectReferences;

	const projectInfo: ProjectInfo = {
		input,
		singleOutput,
		compiler,
		options,
		projectReferences,
		typescript,
		directory: projectDirectory,
		// Set when `project` is called
		output: undefined,
		reporter: undefined
	};

	return project as Project;
}

function src(this: Project) {
	if (arguments.length >= 1) {
		utils.message("tsProject.src() takes no arguments", "Use gulp.src(..) if you need to specify a glob");
	}

	let base: string;
	if (this.options["rootDir"]) {
		base = path.resolve(this.projectDirectory, this.options["rootDir"]);
	}

	const { extends: _extends, ...config } = this.rawConfig;

	const { fileNames, errors } = this.typescript.parseJsonConfigFileContent(
						config,
						this.typescript.sys,
						path.resolve(this.projectDirectory),
						undefined,
						this.configFileName);

	for (const error of errors) {
		console.log(error.messageText);
	}

	if (base === undefined) base = utils.getCommonBasePathOfArray(
		fileNames.filter(file => file.substr(-5) !== ".d.ts")
			.map(file => path.dirname(file)));

	const vinylOptions = { base, allowEmpty: true };
	return vfs.src(fileNames, vinylOptions);
}

export interface ICompileStream extends NodeJS.ReadWriteStream {
	js: stream.Readable;
	dts: stream.Readable;
}
class CompileStream extends stream.Duplex implements ICompileStream {
	constructor(project: ProjectInfo) {
		super({objectMode: true});

		this.project = project;
	}

	private project: ProjectInfo;

	_write(file: any, encoding: string, cb: (err?: any) => void): void;
	_write(file: VinylFile, encoding: string, cb = (err?: any) => {}) {
		if (!file) return cb();

		if (file.isNull()) {
			cb();
			return;
		}
		if (file.isStream()) {
			return cb(new PluginError('gulp-typescript', 'Streaming not supported'));
		}

		const inputFile = this.project.input.addGulp(file);

		this.project.compiler.inputFile(inputFile);

		cb();
	}
	_read() {

	}

	end(chunk?: any, encoding?: any, callback?: any) {
		if (typeof chunk === 'function') {
			this._write(null, null, chunk);
		} else if (typeof encoding === 'function') {
			this._write(chunk, null, encoding);
		} else {
			this._write(chunk, encoding, callback);
		}
		this.project.compiler.inputDone();
	}

	js: stream.Readable = new CompileOutputStream();
	dts: stream.Readable = new CompileOutputStream();
}
class CompileOutputStream extends stream.Readable {
	constructor() {
		super({objectMode: true});
	}

	_read() {

	}
}
