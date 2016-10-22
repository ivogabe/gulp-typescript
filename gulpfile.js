var gulp = require('gulp');
var rimraf = require('rimraf');
var fs = require('fs');
var path = require('path');
var mergeStream = require('merge-stream');
var ts = require('./release/main');

var plumber = require('gulp-plumber');
var sourcemaps = require('gulp-sourcemaps');
var concat = require('gulp-concat');
var header = require('gulp-header');
var diff = require('gulp-diff');

var tsVersions = {
	dev: './typescript/dev',
	release14: './typescript/1-4',
	release15: './typescript/1-5',
	release16: './typescript/1-6',
	release17: './typescript/1-7'
};

function findTSDefinition(location) {
	return path.join(path.dirname(require.resolve(location)), 'typescript.d.ts');
}

var tsOptions = {
	target: 'es5',
	module: 'commonjs',
	declaration: true,
	preserveConstEnums: true,
	typescript: require('./typescript/dev')
};
var tsProject = ts.createProject(tsOptions);

var paths = {
	scripts: ['lib/**.ts'],
	definitionTypeScript: [findTSDefinition('typescript')],
	releaseBeta: 'release-2',
	release: 'release'
};

var tests = fs.readdirSync(path.join(__dirname, 'test')).filter(function(dir) {
	return dir !== 'baselines' && dir !== 'output' && dir.substr(0, 1) !== '.';
});

// Clean
gulp.task('clean', function(cb) {
	rimraf(paths.releaseBeta, cb);
});
gulp.task('clean-test', function(cb) {
	rimraf('test/output', cb);
});
gulp.task('clean-release', function(cb) {
	rimraf(paths.release, cb);
});

// Compile sources
gulp.task('scripts', ['clean'], function() {
	var tsResult = gulp.src(paths.scripts.concat(paths.definitionTypeScript))
		.pipe(tsProject());

	return mergeStream(tsResult.js, tsResult.dts)
		.pipe(gulp.dest(paths.releaseBeta));
});

// Type checking against multiple versions of TypeScript
// Checking against the current release of TypeScript on NPM can be done using `gulp scripts`.
gulp.task('typecheck-1.4', function() {
	return gulp.src(paths.scripts.concat([
		'!definitions/typescript.d.ts',
		findTSDefinition(tsVersions.release14)
	])).pipe(ts(tsOptions));
});
gulp.task('typecheck-1.5', function() {
	return gulp.src(paths.scripts.concat([
		'!definitions/typescript.d.ts',
		findTSDefinition(tsVersions.release15)
	])).pipe(ts(tsOptions));
});
gulp.task('typecheck-1.6', function() {
	return gulp.src(paths.scripts.concat([
		'!definitions/typescript.d.ts',
		findTSDefinition(tsVersions.release16)
	])).pipe(ts(tsOptions));
});
gulp.task('typecheck-1.7', function() {
	return gulp.src(paths.scripts.concat([
		'!definitions/typescript.d.ts',
		findTSDefinition(tsVersions.release17)
	])).pipe(ts(tsOptions));
});
gulp.task('typecheck-dev', function() {
	return gulp.src(paths.scripts.concat([
		'!definitions/typescript.d.ts',
		findTSDefinition(tsVersions.dev)
	])).pipe(ts(tsOptions));
});

gulp.task('typecheck', [/* 'typecheck-1.4', 'typecheck-1.5', 'typecheck-1.6', */ 'typecheck-dev']);

// Tests

// helper function for running a test.
function runTest(name, callback) {
	var newTS = require('./release-2/main');
	// We run every test on multiple typescript versions:
	var libs = [
		['2.0', undefined],
		['dev', require(tsVersions.dev)]
		/* ['1.4', require(tsVersions.release14)],
		['1.5', require(tsVersions.release15)],
		['1.6', require(tsVersions.release16)],
		['1.7', require(tsVersions.release17)] */
	];
	var test = require('./test/' + name + '/gulptask.js');

	var done = 0;

	fs.mkdirSync('test/output/' + name);
	for (var i = 0; i < libs.length; i++) {
		(function(i) {
			var lib = libs[i];
			var output = 'test/output/' + name + '/' + lib[0] + '/';
			var errors = [];
			var finishInfo;
			var reporter = {
				error: function(err) {
					if (path.sep === '\\') { //filenames embedded in error output contain OS-dependent path separators
						var colon = err.message.indexOf(":");
						if (colon === -1 || !err.diagnostic || err.message.indexOf(path.sep) === -1) {
							return;
						}

						var fileName = err.message.slice(0, colon);
						var detail = err.message.slice(colon);
						fileName = fileName.replace(/\\/g, '/');
						err.message = fileName + detail;
					}

					errors.push(err);
				},
				finish: function(info) {
					finishInfo = info;
				}
			};
			fs.mkdirSync(output);
			test(newTS, lib[1], output, reporter).on('finish', function() {
				fs.writeFileSync(output + 'errors.txt', errors.join('\n') + '\n' + JSON.stringify(finishInfo, null, 4));
				done++;
				callback();
			});
		})(i);
	}
}

gulp.task('test-run', ['clean-test', 'scripts'], function(cb) {
	fs.mkdirSync('test/output/');

	var pending = tests.length;
	if (pending === 0) {
		cb();
		return;
	}

	var isFailed = false;
	for (var i = 0; i < tests.length; i++) {
		runTest(tests[i], function(failed) {
			isFailed = isFailed || failed;
			pending--;
			if (pending === 0) {
				if (isFailed) {
					cb(new Error('Tests failed'));
				} else {
					cb();
				}
			}
		});
	}
})

gulp.task('test', ['test-run'], function(cb) {
	var failed = false;
	function onError(error) {
		failed = true;
	}
	return gulp.src('test/output/**/*.*')
		.pipe(plumber())
		.pipe(diff('test/baselines/'))
		.on('error', onError)
		.pipe(diff.reporter({ fail: true }))
		.on('error', onError)
		.on('finish', function() {
			if (failed) {
				throw new Error('Tests failed');
			}
		});
});

// Accept new baselines
gulp.task('test-baselines-accept', function(cb) {
	rimraf('test/baselines', function() {
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
