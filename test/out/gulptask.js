var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS, lib, output, reporter) {
	var tsResult = gulp.src('test/out/*.ts')
					   .pipe(sourcemaps.init())
					   .pipe(newTS({
							declarationFiles: true,
							sourceRoot: '',
						    out: 'concat.js',
						    typescript: lib
					   }, undefined, reporter));
	tsResult.dts.pipe(gulp.dest(output + '/dts'));
	return tsResult.js
			.pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '../../../../out/' }))
			.pipe(gulp.dest(output + '/js'));
}
