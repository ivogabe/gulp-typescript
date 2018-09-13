import * as ts from 'typescript';

export type FinalTransformers = undefined | ((program?: ts.Program) => ts.CustomTransformers)

export type GetCustomTransformers = string | ((program?: ts.Program) => ts.CustomTransformers | undefined)

export interface TsConfig {
	files?: string[];
	include?: string[];
	exclude?: string[];
	compilerOptions?: any;
}
