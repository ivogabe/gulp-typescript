var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS, lib, output, reporter) {
	var tsResult = gulp.src('test/out/*.ts')
		.pipe(sourcemaps.init())
		.pipe(newTS({
			declarationFiles: true,
			out: 'concat.js',
			typescript: lib,
			target: 'es6',
			types: []
		}, reporter))
		.on('error', () => {});

	tsResult.dts.pipe(gulp.dest(output + '/dts'));
	return tsResult.js
		.pipe(sourcemaps.write('.', { sourceRoot: '../../../../out/' }))
		.pipe(gulp.dest(output + '/js'));
}
