var gulp = require('gulp');
var rimraf = require('rimraf');
var fs = require('fs');
var path = require('path');
var ts = require('./release/main');
var argv = require('yargs').argv;

var sourcemaps = require('gulp-sourcemaps');
var concat = require('gulp-concat');
var header = require('gulp-header');
var diff = require('gulp-diff');

var tsOptions = {
	target: 'es5',
	module: 'commonjs',
	noExternalResolve: true,
	preserveConstEnums: true
};
var tsProject = ts.createProject(tsOptions);

var paths = {
	scripts: ['lib/**.ts', 'definitions/**.ts'],
	releaseBeta: 'release-2',
	release: 'release'
};

var tests = fs.readdirSync(path.join(__dirname, 'test')).filter(function(dir) {
	return dir !== 'baselines' && dir !== 'output' && dir.substr(0, 1) !== '.';
});

gulp.task('clean', function(cb) {
	rimraf(paths.releaseBeta, cb);
});
gulp.task('clean-test', function(cb) {
	rimraf('test/output', cb);
});
gulp.task('clean-release', function(cb) {
	rimraf(paths.release, cb);
});

gulp.task('scripts', ['clean'], function() {
	var tsResult = gulp.src(paths.scripts)
					   .pipe(ts(tsProject));

	return tsResult.js
		.pipe(gulp.dest(paths.releaseBeta));
});

// Check against the master of TypeScript
gulp.task('typecheck-dev', function() {
	return gulp.src(paths.scripts.concat([
		'!defintions/typescript.d.ts',
		path.resolve(require.resolve('typescript-dev'), './typescript.d.ts')
	])).pipe(ts(tsOptions));
});

// Check against jsx-typescript
gulp.task('typecheck-jsx', function() {
	return gulp.src(paths.scripts.concat([
		'!defintions/typescript.d.ts',
		path.resolve(require.resolve('jsx-typescript'), './typescript.d.ts')
	])).pipe(ts(tsOptions));
});

// Checking against the current release of TypeScript on NPM can be done using `gulp scripts`.
gulp.task('typecheck', ['typecheck-dev', 'typecheck-jsx']);

function runTest(name, callback) {
	var newTS = require('./release-2/main');
	var libs = [
		['default', undefined],
		['ts-next', require('typescript-dev')],
		// ['jsx', require('jsx-typescript')] // TODO: Add jsx-typescript here. It currently throws an error when adding it.
	];
	var test = require('./test/' + name + '/gulptask.js');

	fs.mkdirSync('test/output/' + name);
	for (var i = 0; i < libs.length; i++) {
		(function(i) {
			var lib = libs[i];
			var output = 'test/output/' + name + '/' + lib[0] + '/';
			var errors = [];
			var reporter = {
				error: function(err) {
					errors.push(err);
				}
			};
			fs.mkdirSync(output);
			test(newTS, lib[1], output, reporter).on('finish', function() {
				fs.writeFileSync(output + 'errors.txt', errors);
				function onError(error) {
					console.error('Test ' + name + ' failed: ' + error.message);
				}
				gulp.src('test/output/' + name + '/**')
					.pipe(diff('test/baselines/' + name))
					.on('error', onError)
					.pipe(diff.reporter({ fail: true }))
					.on('error', onError)
					.on('finish', callback);
			});
		})(i);
	}
}

gulp.task('test', ['clean-test', 'scripts'], function(cb) {
	fs.mkdirSync('test/output/');

	var currentTests = tests;
	if (argv.tests !== undefined) {
		currentTests = argv.tests.split(',');
	}

	var pending = currentTests.length;
	if (pending === 0) {
		cb();
		return;
	}

	for (var i = 0; i < currentTests.length; i++) {
		runTest(currentTests[i], function() {
			pending--;
			if (pending === 0) cb();
		});
	}
});

gulp.task('test-baselines-accept', function(cb) {
	rimraf(paths.releaseBeta, function() {
		gulp.src('test/output/**').pipe(gulp.dest('test/baselines')).on('finish', cb);
	});
});

gulp.task('release', function() {
	return gulp.src(paths.releaseBeta + '/**').pipe(gulp.dest(paths.release));
});

gulp.task('watch', ['scripts'], function() {
	gulp.watch(paths.scripts, ['scripts']);
});

gulp.task('default', ['scripts', 'typecheck', 'test']);
