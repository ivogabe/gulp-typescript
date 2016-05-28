var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var babel = require('gulp-babel');

// gulp-typescript => babel => uglify with end-to-end sourcemaps
// with a source directory (Main) that TypeScript removes from virtual filenames
module.exports = function(newTS, lib, output, reporter) {
	var project = newTS.createProject('test/sourceMapPipeline/tsconfig.json', {
		typescript: lib
	});

	return project.src()
		.pipe(sourcemaps.init())
		.pipe(newTS(project, undefined, reporter)).js
		// No sane person would ever pipe TypeScript output through
		// babel, but we are doing it to force a different tool to
		// operate on our output JSX to ensure we output source maps
		// with proper virtual paths.
		.pipe(babel({
			presets: ['react']
		}))
		.pipe(uglify())
		// sourceRoot has /Main/ explicitly added because TypeScript lops it off,
		// and there's no convenient way to automatically recover that.
		.pipe(sourcemaps.write(".", { sourceRoot: '../../../../sourceMapPipeline/Main/' }))
		.pipe(gulp.dest(output + "js"));
}
