import fs from "node:fs";
import typescript from '@rollup/plugin-typescript';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))

export default [
	{
		input: 'src/index.ts',
		plugins: [ typescript() ],
		output: [
			{ file: pkg.main, format: 'cjs' },
			{ file: pkg.module, format: 'es' }
		]
	}
];
