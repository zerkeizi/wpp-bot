// Image search by scraping Bing Images (no API key). Bing's results page loads its results
// with JavaScript, so this calls the endpoint that page uses (/images/async), which returns
// an HTML fragment where every result carries a JSON blob in an m="..." attribute.
// If Bing changes that markup, searchImages() starts returning [] or throwing.

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const SEARCH_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// how many results to try before giving up
const MAX_RESULTS_TRIED = 5;

/**
 * @param {string} query
 * @returns {Promise<{ url: string, thumbnailUrl?: string }[]>} results in Bing's order
 */
export const searchImages = async (query) => {
	const url = new URL('https://www.bing.com/images/async');
	url.search = new URLSearchParams({
		q: query,
		first: '0',
		count: '10',
		adlt: 'strict', // safe search
		mmasync: '1',
	}).toString();

	const res = await fetch(url, {
		headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
		signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
	});
	if (!res.ok) throw new Error(`Bing respondeu HTTP ${res.status}`);
	const html = await res.text();

	return [...html.matchAll(/\sm="([^"]+)"/g)]
		.map(([, raw]) => {
			try {
				// murl: original image, turl: thumbnail hosted by Bing
				const { murl, turl } = JSON.parse(decodeHtmlEntities(raw));
				return murl ? { url: murl, thumbnailUrl: turl } : null;
			} catch {
				return null;
			}
		})
		.filter(Boolean);
};

/**
 * Downloads the first result that works. For each result it tries the original image,
 * then Bing's thumbnail (some sites block downloads or are slow).
 * @returns {Promise<{ buffer: Buffer, mime: string } | null>} null when nothing could be downloaded
 */
export const downloadFirstImage = async (results) => {
	for (const { url, thumbnailUrl } of results.slice(0, MAX_RESULTS_TRIED)) {
		for (const candidate of [url, thumbnailUrl]) {
			if (!candidate) continue;
			try {
				return await downloadImage(candidate);
			} catch (e) {
				console.warn('Falha ao baixar imagem', candidate, e.message);
			}
		}
	}
	return null;
};

const downloadImage = async (url) => {
	const res = await fetch(url, {
		headers: { 'User-Agent': USER_AGENT },
		signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);

	const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
	// svg can't be turned into a sticker reliably
	if (!mime.startsWith('image/') || mime === 'image/svg+xml') throw new Error(`tipo não suportado: ${mime || 'desconhecido'}`);
	if (Number(res.headers.get('content-length')) > MAX_IMAGE_BYTES) throw new Error('imagem grande demais');

	const buffer = Buffer.from(await res.arrayBuffer());
	if (buffer.length > MAX_IMAGE_BYTES) throw new Error('imagem grande demais');
	return { buffer, mime };
};

const decodeHtmlEntities = (text) => text
	.replace(/&quot;/g, '"')
	.replace(/&#39;/g, "'")
	.replace(/&lt;/g, '<')
	.replace(/&gt;/g, '>')
	.replace(/&amp;/g, '&');
