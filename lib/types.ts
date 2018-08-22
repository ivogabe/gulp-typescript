import * as ts from 'typescript';

export type FinalTransformers = undefined | (() => ts.CustomTransformers)

export type GetCustomTransformers = string | (() => ts.CustomTransformers | undefined)

export interface TsConfig {
	files?: string[];
	include?: string[];
	exclude?: string[];
	compilerOptions?: any;
}
