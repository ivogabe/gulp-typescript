/// <reference path="../typings/tsd.d.ts" />

import Vinyl = require('vinyl');

export interface VinylFile extends Vinyl {
	sourceMap?: any;
}
