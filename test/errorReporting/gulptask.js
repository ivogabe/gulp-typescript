var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS, lib, output, reporter) {
	var errors = 0;
	var tsResult = gulp.src('test/errorReporting/*.ts')
		.pipe(sourcemaps.init())
		.pipe(newTS({ typescript: lib }, undefined, reporter));

	tsResult.dts.pipe(gulp.dest(output + 'dts'));
	return tsResult.js
		.pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '../../../../errorReporting/' }))
		.pipe(gulp.dest(output + 'js'));
}
