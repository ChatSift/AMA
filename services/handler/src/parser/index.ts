import type { ParserOutput } from 'lexure';
import {
  APIApplicationCommandInteractionDataOption,
  ApplicationCommandOptionType,
  ApplicationCommandInteractionDataOptionString
} from 'discord-api-types/v8';

interface ParseOptionsOutput {
  ordered: string[];
  flags: string[];
  options: [string, string[]][];
}

const parseOptions = (
  options: APIApplicationCommandInteractionDataOption[],
  ordered: string[] = [],
  flags: string[] = [],
  opts: [string, string[]][] = []
): ParseOptionsOutput => {
  if (options.length === 0) return { ordered, flags, options: opts };

  const top = options.shift();
  if (!top) return { ordered, flags, options: opts };

  if (top.type === ApplicationCommandOptionType.BOOLEAN && top.value) {
    flags.push(top.name);
  } else {
    opts.push([top.name, [(top as ApplicationCommandInteractionDataOptionString).value]]);
  }

  if ('options' in top && top.options.length) {
    ordered.push(top.name);
    [ordered, flags, opts] = Object.values(parseOptions(top.options, ordered, flags, opts));
  }

  return parseOptions(options, ordered, flags, opts);
};

export const parseInteraction = (args: APIApplicationCommandInteractionDataOption[]): ParserOutput => {
  const { ordered, flags, options } = parseOptions(args);

  return {
    ordered: ordered.filter(v => v).map(s => ({ raw: s, trailing: '', value: s })),
    flags: new Set(flags),
    options: new Map(options)
  };
};
