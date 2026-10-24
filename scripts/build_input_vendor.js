/** Copy pinned, lazily loaded document readers for static hosting. */
import { mkdir, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const vendor = new URL('vendor/importers/', root);
await mkdir(new URL('pdfjs/', vendor), { recursive: true });
for (const name of ['pdf.min.mjs', 'pdf.worker.min.mjs']) {
  await copyFile(new URL(`node_modules/pdfjs-dist/legacy/build/${name}`, root), new URL(`pdfjs/${name.replace('.mjs', '.js')}`, vendor));
}
for (const name of ['cmaps', 'standard_fonts']) {
  await cp(new URL(`node_modules/pdfjs-dist/${name}/`, root), new URL(`pdfjs/${name}/`, vendor), { recursive: true });
}
await copyFile(new URL('node_modules/pdfjs-dist/LICENSE', root), new URL('pdfjs/LICENSE', vendor));
await copyFile(new URL('node_modules/fflate/esm/browser.js', root), new URL('fflate.js', vendor));
await copyFile(new URL('node_modules/fflate/LICENSE', root), new URL('LICENSE-fflate', vendor));
const versions = {};
for (const name of ['pdfjs-dist', 'fflate']) {
  versions[name] = JSON.parse(await readFile(new URL(`node_modules/${name}/package.json`, root), 'utf8')).version;
}
await writeFile(new URL('versions.json', vendor), JSON.stringify(versions, null, 2) + '\n');
console.log('按需导入组件已准备：', versions);
