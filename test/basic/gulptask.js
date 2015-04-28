var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS, lib, output, reporter) {
	var tsResult = gulp.src('test/basic/*.ts')
		.pipe(sourcemaps.init())
		.pipe(newTS({
			declarationFiles: true,
			module: 'amd',
			noExternalResolve: true,
			sourceRoot: '',
			typescript: lib,
			outDir: output + 'js'
		}, undefined, reporter));

	// tsResult.map.pipe(gulp.dest('test/output/test-3/map'));
	tsResult.dts.pipe(gulp.dest(output + '/dts'));
	return tsResult.js
		.pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '../../../../basic/' }))
		.pipe(gulp.dest(output + 'js'));
}
