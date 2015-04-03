///<reference path='../definitions/ref.d.ts'/>
var ts = require('typescript');
var tsApi = require('./tsapi');
var gutil = require('gulp-util');
function nullReporter() {
    return {};
}
exports.nullReporter = nullReporter;
function defaultReporter() {
    return {
        error: function (error) {
            console.error(error.message);
        }
    };
}
exports.defaultReporter = defaultReporter;
function longReporter() {
    return {
        error: function (error) {
            if (error.tsFile) {
                console.error('[' + gutil.colors.gray('gulp-typescript') + '] ' + gutil.colors.red(error.fullFilename + '(' + error.startPosition.line + ',' + error.startPosition.character + '): ') + 'error TS' + error.diagnostic.code + ' ' + error.diagnostic.messageText);
            }
            else {
                console.error(error.message);
            }
        }
    };
}
exports.longReporter = longReporter;
function fullReporter(fullFilename) {
    if (fullFilename === void 0) { fullFilename = false; }
    return {
        error: function (error, typescript) {
            console.error('[' + gutil.colors.gray('gulp-typescript') + '] '
                + gutil.colors.bgRed(error.diagnostic.code + '')
                + ' ' + gutil.colors.red(tsApi.flattenDiagnosticMessageText(ts, error.diagnostic.messageText)));
            if (error.tsFile) {
                console.error('> ' + gutil.colors.gray('file: ') + (fullFilename ? error.fullFilename : error.relativeFilename) + gutil.colors.gray(':'));
                var lines = error.tsFile.text.split(/(\r\n|\r|\n)/);
                var logLine = function (lineIndex, errorStart, errorEnd) {
                    var line = lines[lineIndex - 1];
                    if (errorEnd === undefined)
                        errorEnd = line.length;
                    console.error('> ' + gutil.colors.gray('[' + lineIndex + '] ')
                        + line.substring(0, errorStart - 1)
                        + gutil.colors.red(line.substring(errorStart - 1, errorEnd))
                        + line.substring(errorEnd));
                };
                for (var i = error.startPosition.line; i <= error.endPosition.line; i++) {
                    logLine(i, i === error.startPosition.line ? error.startPosition.character : 0, i === error.endPosition.line ? error.endPosition.character : undefined);
                }
            }
        }
    };
}
exports.fullReporter = fullReporter;
