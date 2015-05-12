function isTS14(typescript) {
    return !('findConfigFile' in typescript);
}
exports.isTS14 = isTS14;
function getFileName(thing) {
    if (thing.filename)
        return thing.filename; // TS 1.4
    return thing.fileName; // TS 1.5
}
exports.getFileName = getFileName;
function getDiagnosticsAndEmit(program) {
    if (program.getDiagnostics) {
        var errors = program.getDiagnostics();
        if (!errors.length) {
            // If there are no syntax errors, check types
            var checker = program.getTypeChecker(true);
            var semanticErrors = checker.getDiagnostics();
            var emitErrors = checker.emitFiles().diagnostics;
            errors = semanticErrors.concat(emitErrors);
        }
        return errors;
    }
    else {
        var errors = program.getSyntacticDiagnostics();
        if (errors.length === 0)
            errors = program.getGlobalDiagnostics();
        if (errors.length === 0)
            errors = program.getSemanticDiagnostics();
        var emitOutput = program.emit();
        return errors.concat(emitOutput.diagnostics);
    }
}
exports.getDiagnosticsAndEmit = getDiagnosticsAndEmit;
function getLineAndCharacterOfPosition(typescript, file, position) {
    if (file.getLineAndCharacterOfPosition) {
        var lineAndCharacter = file.getLineAndCharacterOfPosition(position);
        return {
            line: lineAndCharacter.line + 1,
            character: lineAndCharacter.character + 1
        };
    }
    else {
        return file.getLineAndCharacterFromPosition(position);
    }
}
exports.getLineAndCharacterOfPosition = getLineAndCharacterOfPosition;
function createSourceFile(typescript, fileName, content, target, version) {
    if (version === void 0) { version = '0'; }
    if (typescript.findConfigFile) {
        return typescript.createSourceFile(fileName, content, target, true);
    }
    else {
        return typescript.createSourceFile(fileName, content, target, version);
    }
}
exports.createSourceFile = createSourceFile;
function flattenDiagnosticMessageText(typescript, messageText) {
    if (typeof messageText === 'string') {
        return messageText;
    }
    else {
        return typescript.flattenDiagnosticMessageText(messageText, "\n");
    }
}
exports.flattenDiagnosticMessageText = flattenDiagnosticMessageText;
