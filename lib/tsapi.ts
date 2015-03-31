import ts = require('typescript');

/*
 * TS1.4 had a simple getDiagnostics method, in 1.5 that method doens't exist,
 * but instead there are now 4 methods which (combined) return all diagnostics.
 */
interface Program14 {
	getDiagnostics(): ts.Diagnostic[];
	getTypeChecker(fullTypeCheckMode: boolean): ts.TypeChecker;
}
interface Program15 {
	getSyntacticDiagnostics(): ts.Diagnostic[];
	getGlobalDiagnostics(): ts.Diagnostic[];
	getSemanticDiagnostics(): ts.Diagnostic[];
	getDeclarationDiagnostics(): ts.Diagnostic[];
	emit(): { diagnostics: ts.Diagnostic[]; };
}
/*
 * In TS 14 the method getLineAndCharacterFromPosition has been renamed from ...From... to ...Of...
 */
interface TSFile14 {
	getLineAndCharacterFromPosition(pos: number): ts.LineAndCharacter;
}
interface TSFile15 {
	getLineAndCharacterOfPosition(pos: number): ts.LineAndCharacter;
}

export function getFileName(thing: { filename: string} | { fileName: string }): string {
	if ((<any> thing).filename) return (<any> thing).filename; // TS 1.4
	return (<any> thing).fileName; // TS 1.5
}
export function getDiagnosticsAndEmit(program: Program14 | Program15): ts.Diagnostic[] {
	if ((<Program14> program).getDiagnostics) {
		var errors = (<Program14> program).getDiagnostics();

		if (!errors.length) {
			// If there are no syntax errors, check types
			var checker = (<Program14> program).getTypeChecker(true);

			var semanticErrors = checker.getDiagnostics();

			var emitErrors = checker.emitFiles().diagnostics;

			errors = semanticErrors.concat(emitErrors);
		}

		return errors;
	} else {
		var errors = (<Program15> program).getSyntacticDiagnostics();
		if (errors.length === 0) errors = (<Program15> program).getGlobalDiagnostics();
		if (errors.length === 0) errors = (<Program15> program).getSemanticDiagnostics();

		var emitOutput = (<Program15> program).emit();
		return errors.concat(emitOutput.diagnostics);
	}
}
export function getLineAndCharacterOfPosition(typescript: typeof ts, file: TSFile14 | TSFile15, position: number) {
	if ((<TSFile15> file).getLineAndCharacterOfPosition) { // TS 1.5
		var lineAndCharacter = (<TSFile15> file).getLineAndCharacterOfPosition(position);
		return {
			line: lineAndCharacter.line + 1,
			character: lineAndCharacter.character + 1
		}
	} else { // TS 1.4
		return (<TSFile14> file).getLineAndCharacterFromPosition(position);
	}
}
