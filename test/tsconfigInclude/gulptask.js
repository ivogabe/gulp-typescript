var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS, lib, output, reporter) {
	var tsProject = newTS.createProject('test/tsconfigInclude/tsconfig.json', {
		typescript: lib,
	});

	var tsResult = tsProject.src()
		.pipe(tsProject(reporter))
		.on('error', () => {});

	return tsResult.pipe(gulp.dest(output));
}
