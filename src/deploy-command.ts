import { Commands } from './command'
import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v9'
import { RESTPostAPIApplicationCommandsJSONBody } from 'discord.js/node_modules/discord-api-types';

const commands: RESTPostAPIApplicationCommandsJSONBody[] = [];

Commands.forEach(v => {
    commands.push(v.data.toJSON())
})

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN || '');

export async function RegistGuildCommand(applicationId: string, guildId: string) {
    await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: commands })
}