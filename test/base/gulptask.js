var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS, lib, output, reporter) {
	var tsProject = newTS.createProject('test/base/tsconfig.json', {
		typescript: lib
	});
	
	var tsResult = tsProject.src()
		.pipe(tsProject(reporter))
		.on('error', () => {});

	tsResult.dts.pipe(gulp.dest(output + '/dts'));
	return tsResult.js
		.pipe(gulp.dest(output + 'js'));
}
