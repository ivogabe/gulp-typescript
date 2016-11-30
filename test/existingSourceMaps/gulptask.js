var gulp = require('gulp');
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS, lib, output, reporter) {
	return gulp.src('test/existingSourceMaps/*.ts')
		.pipe(sourcemaps.init())
		.pipe(concat('all.ts'))
		.pipe(newTS({ typescript: lib }, reporter)).js
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest(output + '/js'));
};
