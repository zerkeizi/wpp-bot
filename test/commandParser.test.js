import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, getTextOptions, textUsageError } from '../src/useCases/messager/commandParser.js';

describe('parseCommand: what counts as a command', () => {
	for (const text of ['/sticker', '/pedido', '/Sticker', '/PEDIDO', '  /sticker', '@5511999999999 /sticker', '@a @b /pedido']) {
		it(`accepts ${JSON.stringify(text)}`, () => {
			assert.deepEqual(parseCommand(text), { flags: {}, positionals: [] });
		});
	}

	for (const text of ['abc /pedido', '/pedidos', '/stickers', 'sticker', 'hello', '', undefined, null]) {
		it(`ignores ${JSON.stringify(text)}`, () => {
			assert.equal(parseCommand(text), null);
		});
	}

	it('keeps words after the command as positionals', () => {
		assert.deepEqual(parseCommand('/pedido abc def').positionals, ['abc', 'def']);
	});
});

describe('parseCommand: flags', () => {
	it('parses -s with the search terms as positionals', () => {
		assert.deepEqual(parseCommand('/pedido -s a person laughing'), {
			flags: { search: true },
			positionals: ['a', 'person', 'laughing'],
		});
	});

	it('parses -h / --help', () => {
		assert.equal(parseCommand('/sticker -h').flags.help, true);
		assert.equal(parseCommand('/sticker --help').flags.help, true);
	});

	it('parses short text flags with double quotes', () => {
		assert.deepEqual(parseCommand('/sticker -t "Oh my" -b GOD').flags, { 'top-text': 'Oh my', 'bottom-text': 'GOD' });
	});

	it('parses --flag="value" and --flag value', () => {
		assert.deepEqual(parseCommand('/sticker --top-text="Oh my" --bottom-text "GOD"').flags, { 'top-text': 'Oh my', 'bottom-text': 'GOD' });
	});

	it('accepts smart quotes from phone keyboards', () => {
		assert.equal(parseCommand('/sticker -t “Oh my”').flags['top-text'], 'Oh my');
	});

	it('keeps apostrophes and special characters in text', () => {
		assert.equal(parseCommand(`/sticker -b "it's 100%: ok \\ ação"`).flags['bottom-text'], `it's 100%: ok \\ ação`);
	});

	it('parses colors as names or #RRGGBB', () => {
		assert.deepEqual(parseCommand('/sticker -t x --text-color=yellow --outline-color=#FF00aa').flags, {
			'top-text': 'x',
			'text-color': 'yellow',
			'outline-color': '#FF00aa',
		});
	});
});

describe('parseCommand: errors', () => {
	const cases = {
		'/sticker --foo': /Opção desconhecida: --foo/,
		'/sticker -x': /Opção desconhecida: -x/,
		'/sticker -t': /--top-text precisa de um valor/,
		'/sticker -t ""': /--top-text precisa de um texto/,
		[`/sticker -b ${'x'.repeat(101)}`]: /no máximo 100 caracteres/,
		'/sticker -t x --text-color=red;drawtext': /Cor inválida em --text-color/,
		'/sticker -t x --outline-color=#fff': /Cor inválida em --outline-color/,
	};
	for (const [text, expected] of Object.entries(cases)) {
		it(`rejects ${JSON.stringify(text.slice(0, 50))}`, () => {
			assert.match(parseCommand(text).error, expected);
		});
	}
});

describe('getTextOptions', () => {
	it('is undefined without text flags, even with colors', () => {
		assert.equal(getTextOptions({ 'text-color': 'red' }), undefined);
	});

	it('maps flags to buildSticker text options', () => {
		assert.deepEqual(getTextOptions({ 'bottom-text': 'GOD', 'outline-color': 'purple' }), {
			topText: undefined,
			bottomText: 'GOD',
			textColor: undefined,
			outlineColor: 'purple',
		});
	});
});

describe('textUsageError', () => {
	const text = { 'top-text': 'hi' };

	it('allows text on images', () => {
		assert.equal(textUsageError(text, 'image'), null);
	});

	it('refuses text on videos', () => {
		assert.match(textUsageError(text, 'video'), /só funciona em imagens/);
	});

	it('refuses text with -s', () => {
		assert.match(textUsageError({ ...text, search: true }, null), /só funciona em imagens/);
	});

	it('does not complain without text flags', () => {
		assert.equal(textUsageError({ search: true }, 'video'), null);
	});
});
