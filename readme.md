gulp-typescript
===============
A gulp plugin that compiles TypeScript files.

Features
--------
- Incremental compilation (so faster builds)
- Error reporting
- Different output streams for .js, .d.ts files.
- Support for sourcemaps using gulp-sourcemaps
- Compile once, and filter different targets
- Not just a wrapper around the ```tsc``` command, but a plugin that uses the TypeScript API.

How to install
--------------
```shell
npm install gulp-typescript
```

Easy usage
----------
```javascript
var ts = require('gulp-typescript');
[...]
var tsResult = [...].pipe(ts(options));
tsResult.dts.pipe(...)
tsResult.js.pipe(...)
```
Example gulpfile:
```javascript
var ts = require('gulp-typescript');
var merge = require('merge2');
gulp.task('scripts', function() {
	var tsResult = gulp.src('lib/*.ts')
					   .pipe(ts({
						   declarationFiles: true,
						   noExternalResolve: true
					   }));
	
	return merge([
		tsResult.dts.pipe(gulp.dest('release/definitions')),
		tsResult.js.pipe(gulp.dest('release/js'))
	]);
});
```

Incremental compilation
-----------------------
Instead of calling ```ts(options)```, you can create a project first, and then call ```ts(project)```. An example:
```javascript
var ts = require('gulp-typescript');
var merge = require('merge2');

var tsProject = ts.createProject({
	declarationFiles: true,
	noExternalResolve: true
});

gulp.task('scripts', function() {
	var tsResult = gulp.src('lib/*.ts')
					.pipe(ts(tsProject));

	return merge([ // Merge the two output streams, so this task is finished when the IO of both operations are done. 
		tsResult.dts.pipe(gulp.dest('release/definitions')),
		tsResult.js.pipe(gulp.dest('release/js'))
	]);
});
gulp.task('watch', ['scripts'], function() {
    gulp.watch('lib/*.ts', ['scripts']);
});
```
When you run ```gulp watch```, the source will be compiled as usual. Then, when you make a change and save the file, your TypeScript files will be compiled in about half the time.

Make sure you create the project outside of a task! Otherwise it won't work.

Options
-------
- ```out``` (string) - Generate one javascript and one definition file. Only works when no module system is used.
- ```removeComments``` (boolean) - Do not emit comments to output.
- ```noImplicitAny``` (boolean) - Warn on expressions and declarations with an implied 'any' type.
- ```noLib``` (boolean) - Don't include the default lib (with definitions for - Array, Date etc)
- ```noEmitOnError``` (boolean) - Do not emit outputs if any type checking errors were reported.
- ```target``` (string) - Specify ECMAScript target version: 'ES3' (default), 'ES5' or 'ES6'.
- ```module``` (string) - Specify module code generation: 'commonjs' or 'amd'.
- ```sourceRoot``` (string) - Specifies the location where debugger should locate TypeScript files instead of source locations.
- ```declarationFiles``` (boolean) - Generates corresponding .d.ts files.
- ```noExternalResolve``` (boolean) - Do not resolve files that are not in the input. Explanation below.
- ```sortOutput``` (boolean) - Sort output files. Usefull if you want to concatenate files (see below).
- ```typescript``` (object) - Use a different version / fork of TypeScript (see below). Use it like: `typescript: require('typescript')` or `typescript: require('my-fork-of-typescript')`

See `lib/main.ts` for a complete list with all options (interface `compile.Settings`).

TypeScript version
------------------
You can use a custom version of TypeScript. Add the version you want (1.4+) to your package.json file as a devDependency. You can also use the master from GitHub to get the latest features. You can use this in your `package.json` to get the master from GitHub:
```javascript
{
	"devDependencies": {
		"gulp-typescript": "*",
		"typescript": "Microsoft/TypeScript"
	}
}
```
And add this to your gulpfile:
```javascript
[...].pipe(ts({
	typescript: require('typescript')
}));
```
You can use 1.5.0-alpha of TypeScript if you write this in your `package.json` file: `"typescript": "1.5.0-alpha"`

It's also possible to use a fork of TypeScript. Add an extra option to the options object like this:
```javascript
[...].pipe(ts({
	typescript: require('my-fork-of-typescript')
}));
```

Filters
-------
There are two ways to filter files:
```javascript
gulp.task('scripts', function() {
	var tsResult = gulp.src('lib/*.ts')
					   .pipe(ts(tsProject, filterSettings));
	
	...
});
```
And
```javascript
gulp.task('scripts', function() {
	var tsResult = gulp.src('lib/*.ts')
					   .pipe(ts(tsProject));
	
	tsResult.pipe(ts.filter(filterSettings)) ... ;
});
```
The first example doesn't add files (that don't pass the filter) to the compiler, the second one does add them to the compiler,
but removes them later from the stream.
You can put as much pipes between compilation and filtering as you want, as long as the filename doesn't change.

At the moment there is only one filter available:

- ```referencedFrom``` (string[]) Only files that are referenced (using ```/// <reference path="..." />```) by the files in this array pass this filter.

Resolving files
---------------
By default, gulp-typescript will try to resolve the files you require and reference. These files are parsed, but not emitted (so you will not see them in the output stream).

If you set the option ```noExternalResolve``` to true, gulp-typescript will not resolve all the requires and references. It assumes that all the necessary files are in the input stream. For example, if you have your ```.ts``` files in the ```lib``` folder, and the ```.d.ts``` files in the ```definitions``` folder, you must use ```gulp.src(['lib/**.ts', 'definitions/**.ts'])``` instead of ```gulp.src(['lib/**.ts'])``` in your gulpfile if you use the option ```noExternalResolve```.

Advantage of ```noExternalResolve```: faster compilation.
Disadvantage of ```noExternalResolve```: won't work when you forgot some input files.
Advice: turn it on, and make sure you list all the input files.

Files that are resolved when ```noExternalResolve``` is off, won't be pushed to the output stream, unless you are using the `out` option.

Concatenate files
------------
The ```tsc``` command has the ability to concatenate using the ```--out``` parameter. There are two approaches to do that in ```gulp-typescript```.

You can use the `out` option. This is fine for small projects, but for big projects it's not always sufficient.

The other option is to use `gulp-concat`. The ```tsc``` command sorts the files using the ```<reference>``` tags. ```gulp-typescript``` does this when you enable the ```sortOutput``` option. You can use the ```referencedFrom``` filter to only include files that are referenced from certain files.

Source maps
----------
Source maps have changed a bit in version 0.2.0. Here's an example gulpfile:
```javascript
var ts = require('gulp-typescript');
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');

gulp.task('scripts', function() {
	var tsResult = gulp.src('lib/*.ts')
					   .pipe(sourcemaps.init()) // This means sourcemaps will be generated
					   .pipe(ts({
						   sortOutput: true,
						   // ...
					   }));
	
	return tsResult.js
				.pipe(concat('output.js')) // You can use other plugins that also support gulp-sourcemaps
				.pipe(sourcemaps.write()) // Now the sourcemaps are added to the .js file
				.pipe(gulp.dest('release/js'));
});
```
For more information, see [gulp-sourcemaps](https://github.com/floridoo/gulp-sourcemaps).

Reporters
---------
You can specify a custom reporter as the 3rd argument of the main function:
```javascript
ts(optionsOrProject, filters, reporter);
```
You can set options, project or filter to `undefined` if you don't want to set them. Available reporters are:
- nullReporter (`ts.reporter.nullReporter()`) - Don't report errors
- defaultReporter (`ts.reporter.defaultReporter()`) - Report basic errors to the console
- longReporter (`ts.reporter.longReporter()`) - Extended version of default reporter, intelliJ link functionality + file watcher error highlighting should work using this one
- fullReporter (`ts.reporter.fullReporter(showFullFilename?: boolean)`) - Show full error messages, with source.

If you want to build a custom reporter, you take a look at `lib/reporter.ts`, in that file is an interface which a reporter should implement.

How to build
------------
First you have to install gulp using ```npm install gulp -g```, if you haven't done already. Then you must install the npm dependencies, using ```npm install```.

The plugin uses itself to compile. There are 2 build directories, ```release``` and ```release-2```. ```release``` must always contain a working build. ```release-2``` contains the last build. When you run ```gulp compile```, the build will be saved in the ```release-2``` directory. ```gulp test``` will compile the source to ```release-2```, and then it will run some tests. If these tests give no errors, you can run ```gulp release```. The contents from ```release-2``` will be copied to ```release```.
