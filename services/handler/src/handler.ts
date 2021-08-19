import { container, singleton, inject } from 'tsyringe';
import { Config, kConfig, kLogger } from '@ama/common';
import { Rest } from '@cordis/rest';
import { send, ControlFlowError, transformInteraction, checkPerm, UserPerms } from './util';
import { readdirRecurse } from '@gaius-bot/readdir';
import { join as joinPath } from 'path';
import { Command, commandInfo } from './Command';
import { Component, componentInfo } from './Component';
import {
  APIGuildInteraction,
  APIApplicationCommandInteractionData,
  RESTPostAPIApplicationCommandsJSONBody,
  RESTPutAPIApplicationCommandsJSONBody,
  Routes,
  InteractionType,
  APIMessageButtonInteractionData
} from 'discord-api-types/v9';
import type { Logger } from 'pino';
import webServer from './webServer';

declare module 'polka' {
  export interface Request {
    rawBody: string;
  }
}

@singleton()
export class Handler {
  public readonly commands = new Map<string, Command>();
  public readonly components = new Map<string, Component>();

  public constructor(
    @inject(kConfig) public readonly config: Config,
    @inject(kLogger) public readonly logger: Logger,
    public readonly rest: Rest
  ) {}

  public async handleInteraction(interaction: APIGuildInteraction) {
    if (!('guild_id' in interaction)) {
      return;
    }

    switch (interaction.type) {
      case InteractionType.ApplicationCommand: {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const data = interaction.data as APIApplicationCommandInteractionData | undefined;
        const command = this.commands.get(data?.name ?? '');

        if (!command) {
          return null;
        }

        try {
          if (command.userPermissions && !await checkPerm(interaction, command.userPermissions)) {
            throw new ControlFlowError(
              `Missing permission to run this command! You must be at least \`${UserPerms[command.userPermissions]!}\``
            );
          }

          await command.exec(interaction, transformInteraction(data!.options ?? [], data!.resolved));
        } catch (error: any) {
          const internal = !(error instanceof ControlFlowError);

          if (internal) {
            this.logger.error({ error }, `Failed to execute command "${data!.name}"`);
          }

          void send(
            interaction, {
              content: internal
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                ? `Something went wrong! It's possible that the bot is missing permissions or that this is a bug.\n\`${error.message}\``
                : error.message,
              flags: 64
            }
          );
        }

        break;
      }

      case InteractionType.MessageComponent: {
        const data = interaction.data as APIMessageButtonInteractionData | undefined;
        const component = this.components.get(data?.custom_id!.split('|')[0] ?? '');
        if (component && data) {
          try {
            if (component.userPermissions && !await checkPerm(interaction, component.userPermissions)) {
              throw new ControlFlowError(
                `Missing permission to run this component! You must be at least \`${UserPerms[component.userPermissions]!}\``
              );
            }

            await component.exec(interaction, []);
          } catch (error: any) {
            const internal = !(error instanceof ControlFlowError);

            if (internal) {
              this.logger.error({ error }, `Failed to execute component "${data.custom_id}"`);
            }

            void send(interaction, {
              content: internal
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                ? `Something went wrong! It's possible that the bot is missing permissions or that this is a bug.\n\`${error.message}\``
                : error.message,
              flags: 64
            });
          }
        }

        break;
      }

      default: {
        this.logger.warn({ interaction }, 'Unexpected interaction type');
      }
    }
  }

  public async registerInteractions(): Promise<void> {
    const interactions = [];

    for await (const file of readdirRecurse(joinPath(__dirname, 'interactions'), { fileExtension: 'js' })) {
      const data = Object.values((await import(file)))[0] as RESTPostAPIApplicationCommandsJSONBody;
      interactions.push(data);
    }

    const commandsRoute = this.config.nodeEnv === 'prod'
      ? Routes.applicationCommands(this.config.clientId)
      : Routes.applicationGuildCommands(this.config.clientId, this.config.testGuildId!);

    await this.rest.put<unknown, RESTPutAPIApplicationCommandsJSONBody>(commandsRoute, { data: interactions });
  }

  public async loadCommands(): Promise<void> {
    for await (const file of readdirRecurse(joinPath(__dirname, 'commands'), { fileExtension: 'js' })) {
      const info = commandInfo(file);

      if (!info) {
        continue;
      }

      const command: Command = container.resolve((await import(file)).default);
      this.commands.set(command.name ?? info.name, command);
    }
  }

  public async loadComponents(): Promise<void> {
    for await (const file of readdirRecurse(joinPath(__dirname, 'components'), { fileExtension: 'js' })) {
      const info = componentInfo(file);

      if (!info) {
        continue;
      }

      const component: Component = container.resolve((await import(file)).default);
      this.components.set(component.name ?? info.name, component);
    }
  }

  public async init(): Promise<void> {
    await this.registerInteractions();

    webServer.listen(4000);

    await this.loadCommands();
    await this.loadComponents();
  }
}
