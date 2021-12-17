import { Log } from '../logger'

import { REST } from '@discordjs/rest';
import { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types';
import { Routes } from 'discord-api-types/v9';

import { CommandBlock } from './dependency'
import * as commands from './commands'
import { Collection, Guild } from 'discord.js';

const CommandCollection = new Collection<string, CommandBlock>()
const CommandList: RESTPostAPIApplicationCommandsJSONBody[] = [];

Object.keys(commands).forEach(key => {
    try {
        let command = Reflect.get(commands, key) as CommandBlock
        CommandCollection.set(command.data.name, command)
        CommandList.push(command.data.toJSON())
    } catch (e) {
        Log.error({ message: `Invalid command block for ${key}: ${e}`})
    }
})

const Rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN!);

export const Commands = CommandCollection

export async function RegistCommand(guild: Guild): Promise<void>;
export async function RegistCommand(guildId: string): Promise<void>;
export async function RegistCommand(guild: any): Promise<void> {
    let guildId: string

    if (guild instanceof Guild) {
        guildId = guild.id
    } else if (typeof guild === 'string') {
        guildId = guild
    } else {
        throw new Error('Unsupported type')
    }

    await Rest.put(Routes.applicationGuildCommands(process.env.DISCORD_APPLICATION!, guildId), { body: CommandList })
}