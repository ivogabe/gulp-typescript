import * as ts from 'typescript';
import * as project from './project';
import * as _reporter from './reporter';
declare function compile(): any;
declare function compile(proj: project.Project, filters?: compile.FilterSettings, theReporter?: _reporter.Reporter): any;
declare function compile(settings: compile.Settings, filters?: compile.FilterSettings, theReporter?: _reporter.Reporter): any;
declare module compile {
    interface Settings {
        out?: string;
        outFile?: string;
        outDir?: string;
        allowNonTsExtensions?: boolean;
        charset?: string;
        codepage?: number;
        declaration?: boolean;
        locale?: string;
        mapRoot?: string;
        noEmitOnError?: boolean;
        noImplicitAny?: boolean;
        noLib?: boolean;
        noLibCheck?: boolean;
        noResolve?: boolean;
        preserveConstEnums?: boolean;
        removeComments?: boolean;
        suppressImplicitAnyIndexErrors?: boolean;
        target: string | ts.ScriptTarget;
        module: string | ts.ModuleKind;
        moduleResolution: string | number;
        jsx: string | number;
        declarationFiles?: boolean;
        noExternalResolve?: boolean;
        sortOutput?: boolean;
        typescript?: typeof ts;
        isolatedModules?: boolean;
        rootDir?: string;
        sourceRoot?: string;
    }
    interface FilterSettings {
        referencedFrom: string[];
    }
    export import Project = project.Project;
    export import reporter = _reporter;
    function createProject(settings?: Settings): any;
    function createProject(tsConfigFileName: string, settings?: Settings): any;
    function filter(project: Project, filters: FilterSettings): NodeJS.ReadWriteStream;
}
export = compile;
