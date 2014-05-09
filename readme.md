gulp-type
=========
A gulp plugin that compiles TypeScript files.

Features
--------
- Incremental compilation (so faster builds)
- Error reporting
- Different output streams for .js, .d.ts files and source maps.
- Not just a wrapper around the ```tsc``` command, but a plugin that uses the TypeScript API.

How to install
--------------
```
npm install gulp-type
```

Easy usage
----------
```
var ts = require('gulp-type');
[...]
var t sResult = [...].pipe(ts(options));
tsResult.map.pipe(...)
tsResult.dts.pipe(...)
tsResult.js.pipe(...)
```
Example gulpfile:
```
var ts = require('gulp-type');
gulp.task('scripts', function() {
	var tsResult = gulp.src('lib/*.ts')
					   .pipe(ts({
						   sourceMap: true,
						   declarationFiles: true,
						   noExternalResolve: true
					   }));
	
	tsResult.map.pipe(gulp.dest('release/js'));
	tsResult.dts.pipe(gulp.dest('release/definitions'));
	return tsResult.js.pipe(gulp.dest('release/js'));
});
```

Incremental compilation
-----------------------
Instead of calling ```ts(options)```, you can create a project first, and then call ```ts(project)```. An example:
```
var ts = require('gulp-type');

var tsProject = ts.createProject({
	sourceMap: true,
	declarationFiles: true,
	noExternalResolve: true
});

gulp.task('scripts', function() {
	var tsResult = gulp.src('lib/*.ts')
					   .pipe(ts(tsProject));
	
	tsResult.map.pipe(gulp.dest('release/js'));
	tsResult.dts.pipe(gulp.dest('release/definitions'));
	return tsResult.js.pipe(gulp.dest('release/js'));
});
gulp.task('watch', ['scripts'], function() {
    gulp.watch('lib/*.ts', ['scripts']);
});
```
When you run ```gulp watch```, the source will be compiled as usual. Then, when you make a change and save the file, your TypeScript files will be compiled in about half the time.

Make sure you create the project outside of a task! Otherwise it won't work.

Options
-------
- ```removeComments``` (boolean) - Do not emit comments to output.
- ```noImplicitAny``` (boolean) - Warn on expressions and declarations with an implied 'any' type.
- ```noLib``` (boolean) - Don't include the default lib (with definitions for - Array, Date etc)
- ```target``` (string) - Specify ECMAScript target version: 'ES3' (default), or 'ES5'.
- ```module``` (string) - Specify module code generation: 'commonjs' or 'amd'
- ```sourceMap``` (boolean) - Generates corresponding .map files.
- ```declarationFiles``` (boolean) - Generates corresponding .d.ts files.
- ```noExternalResolve``` (boolean) - Do not resolve files that are not in the input. Explanation below.

Resolving files
---------------
By default, gulp-type will try to resolve the files you require and reference. These files are parsed, but not emitted (so you will not see them in the output stream).

If you set the option ```noExternalResolve``` to true, gulp-type will not resolve all the requires and references. It assumes that all the necessary files are in the input stream. For example, if you have your ```.ts``` files in the ```lib``` folder, and the ```.d.ts``` files in the ```definitions``` folder, you must use ```gulp.src(['lib/**.ts', 'definitions/**.ts'])``` instead of ```gulp.src(['lib/**.ts'])``` in your gulpfile if you use the option ```noExternalResolve```.

Advantage of ```noExternalResolve```: faster compilation.
Disadvantage of ```noExternalResolve```: won't work when you forgot some input files.
Advice: turn it on, and make sure you list all the input files.

Files that are resolved when ```noExternalResolve``` is off, won't be pushed to the output stream.

Concatate files
------------
The ```tsc``` command has the ability to concatate using the ```--out``` parameter. ```gulp-type``` doesn't have that, because you should use the ```gulp-concat``` plugin for that.