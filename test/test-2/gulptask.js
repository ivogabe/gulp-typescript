var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS) {
	var tsResult = gulp.src('test/test-2/test-2.ts')
					   .pipe(sourcemaps.init())
					   .pipe(newTS({
						   declarationFiles: true,
						   module: 'commonjs'
					   }));
	
	tsResult.dts.pipe(gulp.dest('test/output/test-2/dts'));
	return tsResult.js
			.pipe(sourcemaps.write({ includeContent: false, sourceRoot: '../../../test-2/' }))
			.pipe(gulp.dest('test/output/test-2/js'));
}