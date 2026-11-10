import { parseArgs } from 'node:util';

// The message must start with the command; /pedido and /sticker are aliases
const COMMAND_REGEX = /^\/(pedido|sticker)(?=\s|$)/i;

// Flags accepted after the command (see node:util parseArgs)
const OPTIONS = {
	help: { type: 'boolean', short: 'h' },
};

export const USAGE = [
	'*Como usar*',
	'Envie /sticker (ou /pedido) na legenda de uma imagem/vídeo, ou respondendo a um(a).',
	'',
	'*Opções*',
	'-h, --help  mostra esta ajuda',
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
		return { flags: values, positionals };
	} catch (e) {
		return { error: toFriendlyError(e) };
	}
};

// Splits on whitespace, keeping "double quoted" parts together (quotes removed):
// --top-text="Oh my" -> [--top-text=Oh my]
const tokenize = (input) => (input.match(/(?:[^\s"]+|"[^"]*")+/g) || [])
	.map(token => token.replace(/"/g, ''));

const toFriendlyError = (e) => {
	if (e.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
		const option = e.message.match(/'([^']+)'/)?.[1];
		return `Opção desconhecida: ${option}. Use /sticker -h para ver as opções.`;
	}
	return `Comando inválido. Use /sticker -h para ver as opções.`;
};
