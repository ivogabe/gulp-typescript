///<reference path='../definitions/ref.d.ts'/>
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
function fullReporter(fullFilename) {
    if (fullFilename === void 0) { fullFilename = false; }
    return {
        error: function (error) {
            console.error('[' + gutil.colors.gray('gulp-typescript') + '] ' + gutil.colors.bgRed(error.diagnostic.code + '') + ' ' + gutil.colors.red(error.diagnostic.messageText));
            if (error.tsFile) {
                console.error('> ' + gutil.colors.gray('file: ') + (fullFilename ? error.fullFilename : error.relativeFilename) + gutil.colors.gray(':'));
                var lines = error.tsFile.text.split(/(\r\n|\r|\n)/);
                var logLine = function (lineIndex, errorStart, errorEnd) {
                    var line = lines[lineIndex - 1];
                    if (errorEnd === undefined)
                        errorEnd = line.length;
                    console.error('> ' + gutil.colors.gray('[' + lineIndex + '] ') + line.substring(0, errorStart - 1) + gutil.colors.red(line.substring(errorStart - 1, errorEnd)) + line.substring(errorEnd));
                };
                for (var i = error.startPosition.line; i <= error.endPosition.line; i++) {
                    logLine(i, i === error.startPosition.line ? error.startPosition.character : 0, i === error.endPosition.line ? error.endPosition.character : undefined);
                }
            }
        }
    };
}
exports.fullReporter = fullReporter;
