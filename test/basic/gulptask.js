var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS) {
	var tsResult = gulp.src('test/basic/*.ts')
					   .pipe(newTS({
						   declarationFiles: true,
						   module: 'amd',
						   noExternalResolve: true
					   }));

	// tsResult.map.pipe(gulp.dest('test/output/test-3/map'));
	tsResult.dts.pipe(gulp.dest('test/output/basic/dts'));
	return tsResult.js
			.pipe(sourcemaps.write({ includeContent: false, sourceRoot: '../../../basic/' }))
			.pipe(gulp.dest('test/output/basic/js'));
}
