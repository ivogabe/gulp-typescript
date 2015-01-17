var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS) {
	var tsResult = gulp.src('test/externalResolve/test-2.ts')
					   .pipe(sourcemaps.init())
					   .pipe(newTS({
							declarationFiles: true,
							module: 'commonjs',
							sourceRoot: ''
					   }));

	tsResult.dts.pipe(gulp.dest('test/output/externalResolve/dts'));
	return tsResult.js
			.pipe(sourcemaps.write({ includeContent: false, sourceRoot: '../../../externalResolve/' }))
			.pipe(gulp.dest('test/output/externalResolve/js'));
}
