///<reference path='../typings/tsd.d.ts'/>

import * as ts from 'typescript';
import * as fs from 'fs';
import * as gutil from 'gulp-util';
import * as path from 'path';
import * as stream from 'stream';
import * as project from './project';
import * as utils from './utils';
import * as _filter from './filter';
import * as _reporter from './reporter';
import * as compiler from './compiler';
import * as tsConfig from './tsconfig';
import * as through2 from 'through2';

const PLUGIN_NAME = 'gulp-typescript';

class CompileStream extends stream.Duplex {
	constructor(proj: project.Project) {
		super({objectMode: true});

		this.project = proj;

		// Backwards compatibility
		this.js = this;

		// Prevent "Unhandled stream error in pipe" when compilation error occurs.
		this.on('error', () => {});
	}

	private project: project.Project;

	_write(file: any, encoding, cb: (err?) => void);
	_write(file: gutil.File, encoding, cb = (err?) => {}) {
		if (!file) return cb();

		if (file.isNull()) {
			cb();
			return;
		}
		if (file.isStream()) {
			return cb(new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
		}

		const isFirstFile = this.project.input.firstSourceFile === undefined;

		const inputFile = this.project.input.addGulp(file);

		if (isFirstFile) {
			this.project.currentDirectory = this.project.input.firstSourceFile.gulp.cwd;
		}

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

function compile();
function compile(proj: project.Project, filters?: compile.FilterSettings, theReporter?: _reporter.Reporter);
function compile(settings: compile.Settings, filters?: compile.FilterSettings, theReporter?: _reporter.Reporter);
function compile(param?: any, filters?: compile.FilterSettings, theReporter?: _reporter.Reporter): any {
	let proj: project.Project;
	if (param instanceof project.Project) {
		proj = param;
	} else {
		proj = compile.createProject(param || {});
	}

	const inputStream = new CompileStream(proj);

	proj.reset(inputStream.js, inputStream.dts);
	proj.filterSettings = filters;
	proj.reporter = theReporter || _reporter.defaultReporter();

	proj.compiler.prepare(proj);

	return inputStream;
}

type Enum = utils.Map<number | string>;
function createEnumMap(input: Enum): utils.Map<number> {
	const map: utils.Map<number> = {};
	const keys = Object.keys(input);

	for (const key of keys) {
		let value = input[key];
		if (typeof value === 'number') {
			map[key.toLowerCase()] = value;
		}
	}

	return map;
}

function getScriptTarget(typescript: typeof ts, language: string) {
	const map: utils.Map<ts.ScriptTarget> = createEnumMap((<any> typescript).ScriptTarget);
	return map[language.toLowerCase()];
}

function getModuleKind(typescript: typeof ts, moduleName: string) {
	const map: utils.Map<ts.ModuleKind> = createEnumMap((<any> typescript).ModuleKind);
	return map[moduleName.toLowerCase()];
}

function getCompilerOptions(settings: compile.Settings): ts.CompilerOptions {
	const tsSettings: ts.CompilerOptions = {};

	var typescript = settings.typescript || ts;

	for (const key in settings) {
		if (!Object.hasOwnProperty.call(settings, key)) continue;
		if (key === 'noExternalResolve' ||
			key === 'declarationFiles' ||
			key === 'sortOutput' ||
			key === 'typescript' ||
			key === 'target' || // Target, module & sourceRoot are added below
			key === 'module' ||
			key === 'sourceRoot' ||
			key === 'rootDir') continue;

		tsSettings[key] = settings[key];
	}

	if (typeof settings.target === 'string') {
		tsSettings.target = getScriptTarget(typescript, <string> settings.target);
	} else if (typeof settings.target === 'number') {
		tsSettings.target = <number> settings.target;
	}
	if (typeof settings.module === 'string') {
		tsSettings.module = getModuleKind(typescript, <string> settings.module);
	} else if (typeof settings.module === 'number') {
		tsSettings.module = <number> settings.module;
	}

	if (tsSettings.target === undefined) {
		// TS 1.4 has a bug that the target needs to be set.
		// This block can be removed when a version that solves this bug is published.
		// The bug is already fixed in the master of TypeScript
		tsSettings.target = ts.ScriptTarget.ES3;
	}
	if (tsSettings.module === undefined) {
		// Same bug in TS 1.4 as previous comment.
		tsSettings.module = ts.ModuleKind.None;
	}

	if (settings.sourceRoot !== undefined) {
		console.warn('gulp-typescript: sourceRoot isn\'t supported any more. Use sourceRoot option of gulp-sourcemaps instead.')
	}

	if (settings.declarationFiles !== undefined) {
		tsSettings.declaration = settings.declarationFiles;
	}

	tsSettings.sourceMap = true;

	return tsSettings;
}

module compile {
	export interface Settings {
		out?: string;
		outDir?: string;

		allowNonTsExtensions?: boolean;
		charset?: string;
		codepage?: number;
		declaration?: boolean; // alias of declarationFiles
		locale?: string;
		mapRoot?: string;
		noEmitOnError?: boolean;
		noImplicitAny?: boolean;
		noLib?: boolean;
		noLibCheck?: boolean;
		noResolve?: boolean;
		preserveConstEnums?: boolean;
		removeComments?: boolean;
		suppressImplicitAnyIndexErrors?: boolean;

		target: string | ts.ScriptTarget;
		module: string | ts.ModuleKind;

		declarationFiles?: boolean;

		noExternalResolve?: boolean;
		sortOutput?: boolean;

		typescript?: typeof ts;

		rootDir?: string; // Only supported when using tsProject.src(). If you're not using tsProject.src, use base option of gulp.src instead.
		
		// Unsupported by gulp-typescript
		sourceRoot?: string; // Use sourceRoot in gulp-sourcemaps instead
	}
	export interface FilterSettings {
		referencedFrom: string[];
	}
	export import Project = project.Project;
	export import reporter = _reporter;

	export function createProject(settings?: Settings);
	export function createProject(tsConfigFileName: string, settings?: Settings);
	export function createProject(fileNameOrSettings?: string | Settings, settings?: Settings): Project {
		let tsConfigFileName: string = undefined;
		let tsConfigContent: tsConfig.TsConfig = undefined;
		if (fileNameOrSettings !== undefined) {
			if (typeof fileNameOrSettings === 'string') {
				tsConfigFileName = fileNameOrSettings;
				// load file and strip BOM, since JSON.parse fails to parse if there's a BOM present
				let tsConfigText = fs.readFileSync(fileNameOrSettings).toString();
				tsConfigContent = JSON.parse(tsConfigText.replace(/^\uFEFF/, ''));
				let newSettings: any = {};
				if (tsConfigContent.compilerOptions) {
					for (const key of Object.keys(tsConfigContent.compilerOptions)) {
						newSettings[key] = tsConfigContent.compilerOptions[key];
					}
				}
				if (settings) {
					for (const key of Object.keys(settings)) {
						newSettings[key] = settings[key];
					}
				}
				settings = newSettings;
			} else {
				settings = fileNameOrSettings;
			}
		}

		const project = new Project(tsConfigFileName, tsConfigContent, getCompilerOptions(settings), settings.noExternalResolve ? true : false, settings.sortOutput ? true : false, settings.typescript);
		project.compiler = new compiler.ProjectCompiler();
		return project;
	}

	export function filter(project: Project, filters: FilterSettings): NodeJS.ReadWriteStream {
		let filterObj: _filter.Filter = undefined;
		return through2.obj(function (file: gutil.File, encoding, callback: () => void) {
			if (!filterObj) { // Make sure we create the filter object when the compilation is complete.
				filterObj = new _filter.Filter(project, filters);
			}

			if (filterObj.match(file.path)) this.push(file);

			callback();
		});
	}
}

export = compile;
