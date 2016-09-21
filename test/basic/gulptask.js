var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS, lib, output, reporter) {
	var tsProject = newTS.createProject('test/basic/tsconfig.json', {
		noExternalResolve: true,
		typescript: lib,
		outDir: output + 'js'
	});

	reporter.outputSrcGlob(tsProject);
	var tsResult = tsProject.src()
		.pipe(sourcemaps.init())
		.pipe(newTS(tsProject, undefined, reporter));

	tsResult.dts.pipe(gulp.dest(output + '/dts'));
	return tsResult.js
		.pipe(sourcemaps.write('.', { sourceRoot: '../../../../basic/' }))
		.pipe(gulp.dest(output + 'js'));
}
