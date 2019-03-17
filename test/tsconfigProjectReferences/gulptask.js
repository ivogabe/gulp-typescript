var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var mergeStream = require('merge-stream');

module.exports = function(newTS, lib, output, reporter) {
    var project = newTS.createProject('test/tsconfigProjectReferences/b/tsconfig.json', {
		typescript: lib
	});

	var tsResult = project.src()
		.pipe(sourcemaps.init())
		.pipe(project(reporter))
		.on('error', () => {});

	return mergeStream(
        tsResult.dts
            .pipe(sourcemaps.write("."))
            .pipe(gulp.dest(output + '/dts')),
        tsResult.js
            .pipe(sourcemaps.write("."))
		    .pipe(gulp.dest(output + "js")));
}

module.exports.match = function (lib) {
    const match = /^(\d+)(?=\.)/.exec(lib.version);
    return !!match && parseInt(match[0]) >= 3;
}