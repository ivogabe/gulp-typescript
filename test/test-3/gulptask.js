var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS) {
	var tsResult = gulp.src('test/test-3/*.ts')
					   .pipe(newTS({
						   declarationFiles: true,
						   module: 'amd',
						   noExternalResolve: true
					   }));
	
	// tsResult.map.pipe(gulp.dest('test/output/test-3/map'));
	tsResult.dts.pipe(gulp.dest('test/output/test-3/dts'));
	return tsResult.js
			.pipe(sourcemaps.write({ includeContent: false, sourceRoot: '../../../test-3/' }))
			.pipe(gulp.dest('test/output/test-3/js'));
}