import { decodeCorpus } from './corpus_codec.js';

function dataUrl(name, baseUrl, version) {
  const url = new URL(name, baseUrl);
  if (version) url.searchParams.set('v', version);
  return url;
}

async function checkedFetch(fetcher, url) {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`语料请求失败（HTTP ${response.status}）。`);
  return response;
}

/** 显式 gzip 文件适用于普通静态托管，无须服务器配置 Content-Encoding。 */
export async function loadBrowserCorpus(baseUrl, {
  version, fetcher = globalThis.fetch, Decompressor = globalThis.DecompressionStream
} = {}) {
  let compressedError;
  if (Decompressor) {
    try {
      const response = await checkedFetch(fetcher, dataUrl('poetry.compact.json.gz', baseUrl, version));
      const bytes = new Uint8Array(await response.arrayBuffer());
      let text;
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        const stream = new Blob([bytes]).stream().pipeThrough(new Decompressor('gzip'));
        text = await new Response(stream).text();
      } else {
        // 部分静态服务已自动解压 HTTP 响应，避免二次解压。
        text = new TextDecoder().decode(bytes);
      }
      return decodeCorpus(JSON.parse(text));
    } catch (error) {
      compressedError = error;
    }
  }
  try {
    const response = await checkedFetch(fetcher, dataUrl('poetry.compact.json', baseUrl, version));
    return decodeCorpus(await response.json());
  } catch (error) {
    throw new Error('语料加载失败，请刷新页面或检查网络。', { cause: compressedError || error });
  }
}

export async function loadCorpus(baseUrl, options = {}) {
  if (typeof process !== 'undefined' && process.versions?.node && typeof window === 'undefined') {
    const [{ readFile }, { gunzip }, { promisify }] = await Promise.all([
      import('node:fs/promises'), import('node:zlib'), import('node:util')
    ]);
    const compressed = await readFile(new URL('poetry.compact.json.gz', baseUrl));
    const bytes = await promisify(gunzip)(compressed);
    return decodeCorpus(JSON.parse(bytes.toString('utf8')));
  }
  return loadBrowserCorpus(baseUrl, options);
}
