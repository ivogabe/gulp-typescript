import * as stream from 'stream';
import * as ts from 'typescript';
import * as vfs from 'vinyl-fs';
import * as path from 'path';
import * as through2 from 'through2';
import * as gutil from 'gulp-util';
import * as tsApi from './tsapi';
import * as utils from './utils';
import { FilterSettings } from './main';
import { Reporter } from './reporter';
import { FileCache } from './input';
import { Output } from './output';
import { ICompiler } from './compiler';
import { TsConfig } from './types';

export class Project {
	input: FileCache;
	output: Output;
	previousOutput: Output;
	compiler: ICompiler;

	configFileName: string;
	projectDirectory: string;
	config: TsConfig;

	running = false;

	// region settings

	/**
	 * The TypeScript library that is used for this project.
	 * Can also be jsx-typescript for example.
	 */
	typescript: typeof ts;

	options: ts.CompilerOptions;

	/**
	 * Whether there should not be loaded external files to the project.
	 * Example:
	 *   In the lib directory you have .ts files.
	 *   In the definitions directory you have the .d.ts files.
	 *   If you turn this option on, you should add in your gulp file the definitions directory as an input source.
	 * Advantage:
	 * - Faster builds
	 * Disadvantage:
	 * - If you forget some directory, your compile will fail.
	 */
	noExternalResolve: boolean;

	/**
	 * Sort output based on <reference> tags.
	 * tsc does this when you pass the --out parameter.
	 */
	sortOutput: boolean;

	filterSettings: FilterSettings;

	singleOutput: boolean;

	reporter: Reporter;

	// endregion

	currentDirectory: string;

	constructor(configFileName: string, projectDirectory: string, config: TsConfig, options: ts.CompilerOptions, noExternalResolve: boolean, sortOutput: boolean, typescript = ts) {
		this.typescript = typescript;
		this.configFileName = configFileName;
		this.projectDirectory = projectDirectory;
		this.config = config;
		this.options = options;

		this.noExternalResolve = noExternalResolve;
		this.sortOutput = sortOutput;
		this.singleOutput = options.out !== undefined || options['outFile'] !== undefined;

		this.input = new FileCache(typescript, options);
	}

	/**
	 * Resets the compiler.
	 * The compiler needs to be reset for incremental builds.
	 */
	reset(outputJs: stream.Readable, outputDts: stream.Readable) {
		this.input.reset();
		this.previousOutput = this.output;
		this.output = new Output(this, outputJs, outputDts);
	}

	src() {
		let configPath = path.dirname(this.configFileName);

		let base: string;
		if (this.options["rootDir"]) {
			base = path.resolve(configPath, this.options["rootDir"]);
		}

		if ((this.typescript as tsApi.TypeScript).parseJsonConfigFileContent && (this.typescript as tsApi.TypeScript).sys) {
			const content: any = {};
			if (this.config.include) content.include = this.config.include;
			if (this.config.exclude) content.exclude = this.config.exclude;
			if (this.config.files) content.files = this.config.files;
			if (this.options['allowJs']) content.compilerOptions = { allowJs: true };
			const { fileNames, errors } = (this.typescript as tsApi.TypeScript).parseJsonConfigFileContent(
				content,
				(this.typescript as tsApi.TypeScript).sys,
				this.projectDirectory);

			for (const error of errors) {
				console.log(error.messageText);
			}

			if (base === undefined) base = utils.getCommonBasePathOfArray(
				fileNames.filter(file => file.substr(-5) !== ".d.ts")
					.map(file => path.dirname(file)));

			const vinylOptions = { base, allowEmpty: true };
			return vfs.src(fileNames, vinylOptions);
		}

		if (!this.config.files) {
			let files: string[] = [];

			//If neither 'files' nor 'include' option is defined,
			//take all .ts files (or .ts, .js, .jsx if required) by default.
			if (!this.config.include) {
				files.push(path.join(configPath, '**/*.ts'));

				if (tsApi.isTS16OrNewer(this.typescript)) {
					files.push(path.join(configPath, '**/*.tsx'));
				}
				if ((<tsApi.TSOptions18> this.options).allowJs) {
					files.push(path.join(configPath, '**/*.js'));
					files.push(path.join(configPath, '**/*.jsx'));
				}
			}
			else if (this.config.include instanceof Array) {
				files = files.concat(
					// Include files
					this.config.include.map(file => path.resolve(configPath, file)),
					// Include directories
					this.config.include.map(file => path.resolve(configPath, file) + '/**')
				);
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
}
