var gulp = require('gulp');
var compareVersions = require('compare-versions');

module.exports = function(newTS, lib, output, reporter) {
	var project = newTS.createProject('test/tsConfigIncremental/src/tsconfig.json', {
		typescript: lib
	});

	var tsResult = project.src()
		.pipe(project(reporter))
		.on('error', () => {});

	tsResult.dts
		.pipe(gulp.dest(output + '/dts'));

	tsResult.buildInfo
		.pipe(gulp.dest(output + '/buildInfo'));

	return tsResult.js
		.pipe(gulp.dest(output + "js"));
};

module.exports.match = function (lib) {
	return /^\d+/.test(lib.version) && compareVersions.compare(lib.version, '3.4', '>=');
};
