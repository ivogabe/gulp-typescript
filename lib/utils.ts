///<reference path='../definitions/ref.d.ts'/>
import path = require('path');

export interface Map<T> {
	[key: string]: T;
}

export function normalizePath(pathString: string) {
	return path.normalize(pathString).toLowerCase();
}
