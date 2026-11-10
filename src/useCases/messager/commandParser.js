import { parseArgs } from 'node:util';

// The message must start with the command; /pedido and /sticker are aliases
const COMMAND_REGEX = /^\/(pedido|sticker)(?=\s|$)/i;

// Flags accepted after the command (see node:util parseArgs)
const OPTIONS = {
	help: { type: 'boolean', short: 'h' },
	search: { type: 'boolean', short: 's' },
	'top-text': { type: 'string', short: 't' },
	'bottom-text': { type: 'string', short: 'b' },
	'text-color': { type: 'string' },
	'outline-color': { type: 'string' },
};

const TEXT_FLAGS = ['top-text', 'bottom-text'];
const COLOR_FLAGS = ['text-color', 'outline-color'];
const MAX_TEXT_LENGTH = 100;
// ffmpeg color name or #RRGGBB; also keeps anything else out of the ffmpeg filter string
const COLOR_REGEX = /^(#[0-9a-f]{6}|[a-z]+)$/i;

export const USAGE = [
	'*Como usar*',
	'Envie /sticker (ou /pedido) na legenda de uma imagem/vídeo, ou respondendo a um(a).',
	'Ou busque uma imagem na internet: /pedido -s gato rindo',
	'',
	'*Opções*',
	'-s, --search  busca a imagem pelos termos após o comando',
	'-t, --top-text="texto"  texto no topo (só imagens enviadas)',
	'-b, --bottom-text="texto"  texto embaixo (só imagens enviadas)',
	'--text-color=cor  cor do texto (padrão white). Nome em inglês ou #RRGGBB',
	'--outline-color=cor  cor do contorno (padrão black)',
	'-h, --help  mostra esta ajuda',
	'',
	'Ex: /sticker -t "Oh my" -b "GOD" --text-color=yellow',
].join('\n');

/**
 * Parses a message text as a bot command.
 * @param {string | undefined} text
 * @returns {null | { flags: Object, positionals: string[] } | { error: string }}
 *   null when the text is not a command
 */
export const parseCommand = (text) => {
	if (!text) return null;

	const normalized = text
		// keyboards turn " into smart quotes
		.replace(/[“”„‟]/g, '"')
		// "@bot /sticker" still counts as starting with the command
		.replace(/^\s*(?:@\S+\s*)+/, '')
		.trim();

	const match = normalized.match(COMMAND_REGEX);
	if (!match) return null;

	try {
		const { values, positionals } = parseArgs({
			args: tokenize(normalized.slice(match[0].length)),
			options: OPTIONS,
			strict: true,
			allowPositionals: true,
		});
		const error = validateFlags(values);
		return error ? { error } : { flags: values, positionals };
	} catch (e) {
		return { error: toFriendlyError(e) };
	}
};

// Splits on whitespace, keeping "double quoted" parts together (quotes removed):
// --top-text="Oh my" -> [--top-text=Oh my]
const tokenize = (input) => (input.match(/(?:[^\s"]+|"[^"]*")+/g) || [])
	.map(token => token.replace(/"/g, ''));

const validateFlags = (flags) => {
	for (const name of TEXT_FLAGS) {
		if (flags[name] === undefined) continue;
		if (!flags[name].trim()) return `A opção --${name} precisa de um texto.`;
		if (flags[name].length > MAX_TEXT_LENGTH) return `O texto de --${name} pode ter no máximo ${MAX_TEXT_LENGTH} caracteres.`;
	}
	for (const name of COLOR_FLAGS) {
		if (flags[name] !== undefined && !COLOR_REGEX.test(flags[name])) {
			return `Cor inválida em --${name}: use um nome em inglês (ex: yellow) ou #RRGGBB.`;
		}
	}
	return null;
};

const toFriendlyError = (e) => {
	if (e.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
		const option = e.message.match(/'([^']+)'/)?.[1];
		return `Opção desconhecida: ${option}. Use /sticker -h para ver as opções.`;
	}
	if (e.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') {
		const option = e.message.match(/--[\w-]+/)?.[0];
		return `A opção ${option} precisa de um valor. Use /sticker -h para ver as opções.`;
	}
	return `Comando inválido. Use /sticker -h para ver as opções.`;
};
