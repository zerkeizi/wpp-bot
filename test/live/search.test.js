// Hits the real Bing Images. Not part of `pnpm test` (network, Bing may be slow or block us);
// run with `pnpm test:search`, e.g. when -s stops working.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchImages, downloadFirstImage } from '../../src/useCases/search/bingImages.js';

describe('Bing image search (live)', { timeout: 60_000 }, () => {
	it('finds results and downloads the first usable image', async () => {
		const results = await searchImages('cat with sunglasses');
		assert.ok(results.length > 0, 'no results: Bing markup may have changed (see bingImages.js)');
		for (const result of results) assert.match(result.url, /^https?:\/\//);

		const image = await downloadFirstImage(results);
		assert.ok(image, 'none of the first results could be downloaded');
		assert.match(image.mime, /^image\//);
		assert.ok(image.buffer.length > 0);
	});
});
