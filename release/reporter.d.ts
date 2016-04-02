import * as ts from 'typescript';
import * as gutil from 'gulp-util';
export interface TypeScriptError extends Error {
    fullFilename?: string;
    relativeFilename?: string;
    file?: gutil.File;
    tsFile?: ts.SourceFile;
    diagnostic: ts.Diagnostic;
    startPosition?: {
        position: number;
        line: number;
        character: number;
    };
    endPosition?: {
        position: number;
        line: number;
        character: number;
    };
}
export interface CompilationResult {
    /**
     * Only used when using isolatedModules.
     */
    transpileErrors: number;
    syntaxErrors: number;
    globalErrors: number;
    semanticErrors: number;
    emitErrors: number;
    emitSkipped: boolean;
}
export declare function emptyCompilationResult(): CompilationResult;
export interface Reporter {
    error?: (error: TypeScriptError, typescript: typeof ts) => void;
    finish?: (results: CompilationResult) => void;
}
export declare function nullReporter(): Reporter;
export declare function defaultReporter(): Reporter;
export declare function longReporter(): Reporter;
export declare function fullReporter(fullFilename?: boolean): Reporter;
