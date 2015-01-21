///<reference path='../definitions/ref.d.ts'/>

import ts = require('typescript');
import gutil = require('gulp-util');
import path = require('path');
import stream = require('stream');
import project = require('./project');
import _filter = require('./filter');
import _reporter = require('./reporter');
import through2 = require('through2');

var PLUGIN_NAME = 'gulp-typescript';

class CompileStream extends stream.Duplex {
	constructor(proj: project.Project, theReporter: _reporter.Reporter = _reporter.defaultReporter()) {
		super({objectMode: true});

		this._project = proj;
		this.reporter = theReporter;

		// Backwards compatibility
		this.js = this;

		// Prevent "Unhandled stream error in pipe" when compilation error occurs.
		this.on('error', () => {});
	}

	private reporter: _reporter.Reporter;

	private _project: project.Project;
	private _hasSources: boolean = false;

	_write(file: gutil.File, encoding, cb = (err?) => {}) {
		if (!file) return cb();

		if (file.isNull()) {
			cb();
			return;
		}
		if (file.isStream()) {
			return cb(new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
		}

		this._hasSources = true;
		this._project.addFile(file);
		cb();
	}
	_read() {

	}

	private compile() {
		if (!this._hasSources) {
			this.js.push(null);
			this.dts.push(null);
			return;
		}

		// Try to re-use the output of the previous build. If that fails, start normal compilation.
		if (this._project.lazyCompile(this.js, this.dts)) {
			this.js.push(null);
			this.dts.push(null);
		} else {
			this._project.resolveAll(() => {
				this._project.compile(this.js, this.dts, (err) => {
					if (this.reporter.error) this.reporter.error(err);

					this.emit('error', new gutil.PluginError(PLUGIN_NAME, err.message));
				});
				this.js.push(null);
				this.dts.push(null);
			});
		}
	}

	end(chunk?, encoding?, callback?) {
		this._write(chunk, encoding, callback);
		this.compile();
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
	var proj: project.Project;
	if (param instanceof project.Project) {
		proj = param;
	} else {
		proj = new project.Project(getCompilerOptions(param || {}), (param && param.noExternalResolve) || false, (param && param.sortOutput) || false);
	}

	proj.reset();
	proj.filterSettings = filters;

	var inputStream = new CompileStream(proj, theReporter);

	return inputStream;
}

var langMap: project.Map<ts.ScriptTarget> = {
	'es3': ts.ScriptTarget.ES3,
	'es5': ts.ScriptTarget.ES5,
	'es6': ts.ScriptTarget.ES6
}
var moduleMap: project.Map<ts.ModuleKind> = {
	'commonjs': ts.ModuleKind.CommonJS,
	'amd': ts.ModuleKind.AMD
}

function getCompilerOptions(settings: compile.Settings): ts.CompilerOptions {
	var tsSettings: ts.CompilerOptions = {};

	if (settings.removeComments !== undefined) {
		tsSettings.removeComments = settings.removeComments;
	}

	if (settings.noImplicitAny !== undefined) {
		tsSettings.noImplicitAny = settings.noImplicitAny;
	}
	if (settings.noLib !== undefined) {
		tsSettings.noLib = settings.noLib;
	}
	if (settings.noEmitOnError !== undefined) {
		tsSettings.noEmitOnError = settings.noEmitOnError;
	}

	if (settings.target !== undefined) {
		tsSettings.target = langMap[(settings.target || 'es3').toLowerCase()];
	}
	if (tsSettings.target === undefined) {
		tsSettings.target = ts.ScriptTarget.ES3;
	}
	if (settings.module !== undefined) {
		tsSettings.module = moduleMap[(settings.module || 'none').toLowerCase()];
	}

	if (settings.sourceRoot === undefined) {
		tsSettings.sourceRoot = process.cwd();
	} else {
		tsSettings.sourceRoot = settings.sourceRoot;
	}

	if (settings.declarationFiles !== undefined) {
		tsSettings.declaration = settings.declarationFiles;
	}

	tsSettings.sourceMap = true;

	return tsSettings;
}

module compile {
	export interface Settings {
		//propagateEnumConstants?: boolean;
		removeComments?: boolean;

		//allowAutomaticSemicolonInsertion?: boolean;
		noImplicitAny?: boolean;
		noLib?: boolean;
		noEmitOnError?: boolean
		target?: string;
		module?: string;
		sourceRoot?: string;

		declarationFiles?: boolean;

		//useCaseSensitiveFileResolution?: boolean;

		noExternalResolve?: boolean;
		sortOutput?: boolean;
	}
	export interface FilterSettings {
		referencedFrom: string[];
	}
	export import Project = project.Project;
	export import reporter = _reporter;
	export function createProject(settings: Settings): Project {
		return new Project(getCompilerOptions(settings), settings.noExternalResolve ? true : false, settings.sortOutput ? true : false);
	}

	export function filter(project: Project, filters: FilterSettings): NodeJS.ReadWriteStream {
		var filterObj: _filter.Filter = undefined;
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
