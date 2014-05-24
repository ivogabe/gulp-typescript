///<reference path='node.d.ts'/>
declare module 'gulp-util' {
	export interface FileConstructData {
		base?: string;
		cwd?: string;
		path?: string;
		contents?: any;
	}
	
	export class File {
		constructor(data: FileConstructData);
		
		contents: any;
		base: string;
		cwd: string;
		path: string;
		
		sourceMap: any;

		isNull(): boolean;
		isStream(): boolean;
		isBuffer(): boolean;
	}
	
	export function replaceExtension(path: string, ext: string): string; 
	export class PluginError {
		constructor(pluging: string, msg: string);
	}
	
	export interface ColorStyle {
		(str: string): string;
		
		reset: ColorStyle;
		bold: ColorStyle;
		italic: ColorStyle;
		underline: ColorStyle;
		inverse: ColorStyle;
		strikethrough: ColorStyle;
		black: ColorStyle;
		red: ColorStyle;
		green: ColorStyle;
		yellow: ColorStyle;
		blue: ColorStyle;
		magenta: ColorStyle;
		cyan: ColorStyle;
		white: ColorStyle;
		gray: ColorStyle;
		bgBlack: ColorStyle;
		bgRed: ColorStyle;
		bgGreen: ColorStyle;
		bgYellow: ColorStyle;
		bgBlue: ColorStyle;
		bgMagenta: ColorStyle;
		bgCyan: ColorStyle;
		bgWhite: ColorStyle;
	}
		
	export var colors: ColorStyle;
}
