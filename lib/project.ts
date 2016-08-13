import * as stream from 'stream';
import * as ts from 'typescript';
import * as vfs from 'vinyl-fs';
import * as path from 'path';
import * as through2 from 'through2';
import * as gutil from 'gulp-util';
import * as utils from './utils';
import { Reporter, defaultReporter } from './reporter';
import { FileCache } from './input';
import { Output } from './output';
import { ICompiler, ProjectCompiler, FileCompiler } from './compiler';
import { TsConfig, VinylFile } from './types';

interface PartialProject {
	(reporter?: Reporter): ICompileStream;

	src?(this: Project): NodeJS.ReadWriteStream;

	projectDirectory?: string;
	config?: TsConfig;
	options?: ts.CompilerOptions;
}
export interface Project {
	(reporter?: Reporter): ICompileStream;

	src(this: Project): NodeJS.ReadWriteStream;

	readonly projectDirectory: string;
	readonly config: TsConfig;
	readonly options: ts.CompilerOptions;
}

export interface ProjectInfo {
	input: FileCache;
	output: Output;
	compiler: ICompiler;
	singleOutput: boolean;
	options: ts.CompilerOptions;
	typescript: typeof ts;
	reporter: Reporter;
}

export function setupProject(projectDirectory: string, config: TsConfig, options: ts.CompilerOptions, typescript: typeof ts) {
	const input = new FileCache(typescript, options);
	const compiler: ICompiler = options.isolatedModules ? new FileCompiler() : new ProjectCompiler();
	let running = false;

	if (options.isolatedModules) {
		options.newLine = ts.NewLineKind.LineFeed;
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
		compiler.prepare(projectInfo);

		const stream = new CompileStream(projectInfo);
		projectInfo.output = new Output(projectInfo, stream.js, stream.dts);
		projectInfo.reporter = reporter || defaultReporter;

		stream.on('finish', () => {
			running = false;
		});

		return stream;
	};

	const singleOutput = options.out !== undefined || options.outFile !== undefined;

	project.src = src;
	project.projectDirectory = projectDirectory;
	project.config = config;
	project.options = options;
	
	const projectInfo: ProjectInfo = {
		input,
		singleOutput,
		compiler,
		options,
		typescript,
		// Set when `project` is called
		output: undefined,
		reporter: undefined
	};

	return project as Project;
}

function src(this: Project) {
	let configPath = this.projectDirectory;
	let base: string;
	if (this.options.rootDir) {
		base = path.resolve(configPath, this.options.rootDir);
	}

	if (!this.config.files) {
		let files = [path.join(configPath, '**/*.ts'), path.join(configPath, '**/*.tsx')];

		if (this.options.allowJs) {
			files.push(path.join(configPath, '**/*.js'));
			files.push(path.join(configPath, '**/*.jsx'));
		}

		if (this.config.exclude instanceof Array) {
			files = files.concat(
				// Exclude files
				this.config.exclude.map(file => '!' + path.resolve(configPath, file)),
				// Exclude directories
				this.config.exclude.map(file => '!' + path.resolve(configPath, file) + '/**')
			);
		}
		if (base !== undefined) {
			return vfs.src(files, { base });
		}
		const srcStream = vfs.src(files);
		const sources = new stream.Readable({ objectMode: true });
		sources._read = () => {};
		const resolvedFiles: gutil.File[] = [];
		srcStream.on('data', (file: gutil.File) => {
			resolvedFiles.push(file);
		});
		srcStream.on('finish', () => {
			const sourceFiles = resolvedFiles
				.filter(file => file.path.substr(-5) !== ".d.ts");
			const base = utils.getCommonBasePathOfArray(
				sourceFiles.map(file => path.dirname(file.path))
			);
			for (const file of sourceFiles) {
				file.base = base;
				sources.push(file);
			}
			sources.emit('finish');
		});
		return srcStream;
	}
	const files = this.config.files.map(file => path.resolve(configPath, file));
	if (base === undefined) base = utils.getCommonBasePathOfArray(files.map(file => path.dirname(file)));

	const resolvedFiles: string[] = [];
	const checkMissingFiles = through2.obj(function (file: gutil.File, enc, callback) {
		this.push(file);
		resolvedFiles.push(utils.normalizePath(file.path));
		callback();
	});
	checkMissingFiles.on('finish', () => {
		for (const fileName of this.config.files) {
			const fullPaths = [
				utils.normalizePath(path.join(configPath, fileName)),
				utils.normalizePath(path.join(process.cwd(), configPath, fileName))
			];

			if (resolvedFiles.indexOf(fullPaths[0]) === -1 && resolvedFiles.indexOf(fullPaths[1]) === -1) {
				const error = new Error(`error TS6053: File '${ fileName }' not found.`);
				console.error(error.message);
				checkMissingFiles.emit('error', error);
			}
		}
	});

	const vinylOptions = { base, allowEmpty: true };
	return vfs.src(this.config.files.map(file => path.resolve(configPath, file)), vinylOptions)
		.pipe(checkMissingFiles);
}

export interface ICompileStream extends stream.Readable {
	js: stream.Readable;
	dts: stream.Readable;
}
class CompileStream extends stream.Duplex implements ICompileStream {
	constructor(project: ProjectInfo) {
		super({objectMode: true});

		this.project = project;

		// Backwards compatibility
		this.js = this;

		// Prevent "Unhandled stream error in pipe" when a compilation error occurs.
		this.on('error', () => {});
	}

	private project: ProjectInfo;

	_write(file: any, encoding, cb: (err?) => void);
	_write(file: VinylFile, encoding, cb = (err?) => {}) {
		if (!file) return cb();

		if (file.isNull()) {
			cb();
			return;
		}
		if (file.isStream()) {
			return cb(new gutil.PluginError('gulp-typescript', 'Streaming not supported'));
		}

		const inputFile = this.project.input.addGulp(file);

		this.project.compiler.inputFile(inputFile);

		cb();
	}
	_read() {

	}

	end(chunk?, encoding?, callback?) {
		this._write(chunk, encoding, callback);
		this.project.compiler.inputDone();
	}

	js: stream.Readable;
	dts: stream.Readable = new CompileOutputStream();
}
class CompileOutputStream extends stream.Readable {
	constructor() {
		super({objectMode: true});
	}

	_read() {

	}
}
