/// <reference path="../typings/tsd.d.ts" />

import Vinyl = require('vinyl');

interface File extends Vinyl {
	sourceMap?: any;
}

export = File;