///<reference path='../definitions/ref.d.ts'/>

import gutil = require('gulp-util');
import path = require('path');
import stream = require('stream');
import project = require('./project');
import through2 = require('through2');

var PLUGIN_NAME = 'gulp-typescript';

class CompileStream extends stream.Duplex {
	constructor(proj: project.Project) {
		super({objectMode: true});
		
		this._project = proj;
		
		// Backwards compatibility
		this.js = this;

		// Prevent "Unhandled stream error in pipe" when compilation error occurs.
		this.on('error', () => {}); 
	}
	
	private _project: project.Project;
	
	_write(file: gutil.File, encoding, cb = (err?) => {}) {
		if (!file) return cb();
		
		if (file.isNull()) {
			cb();
			return;
		}
		if (file.isStream()) {
			return cb(new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
		}
		
		this._project.addFile(file);
		cb();
	}
	_read() {
		
	}
	
	private compile() {
		this._project.resolveAll(() => {
			this._project.compile(this.js, this.dts, (err) => { 
				console.error(err.message);
				this.emit('error', new gutil.PluginError(PLUGIN_NAME, err.message));
			});
			this.js.push(null);
			this.dts.push(null);
		});
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
function compile(proj: project.Project, filters: compile.Filters);
function compile(settings: compile.Settings, filters: compile.Filters);
function compile(param?: any, filters?: compile.Filters): any {
	// TODO: filters
	var proj: project.Project;
	if (param instanceof project.Project) {
		proj = param;
	} else {
		proj = new project.Project(getCompilerOptions(param || {}), (param && param.noExternalResolve) || false, (param && param.sortOutput) || false);
	}
	
	proj.reset();
	
	var inputStream = new CompileStream(proj);
	
	return inputStream;
}

var langMap: project.Map<ts.ScriptTarget> = {
	'es3': ts.ScriptTarget.ES3,
	'es5': ts.ScriptTarget.ES5
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
	
	if (settings.target !== undefined) {
		tsSettings.target = langMap[(settings.target || 'es3').toLowerCase()];
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
		target?: string;
		module?: string;
		sourceRoot?: string;

		declarationFiles?: boolean;
		
		//useCaseSensitiveFileResolution?: boolean;
		
		noExternalResolve?: boolean;
		sortOutput?: boolean;
	}
	export interface Filters {
		referencedFrom: string[];
	}
	export import Project = project.Project;
	export function createProject(settings: Settings): Project {
		return new Project(getCompilerOptions(settings), settings.noExternalResolve ? true : false, settings.sortOutput ? true : false);
	}
	
	export function filter(project: Project, filters: Filters): NodeJS.ReadWriteStream {
		return through2.obj((file: gutil.File, encoding, callback: () => void) => {
			if (project.filterFile(file.path, filters)) {
				this.push(file);
			}
			
			callback();
		});
	}
}

export = compile;
