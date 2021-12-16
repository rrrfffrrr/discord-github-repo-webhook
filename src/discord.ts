import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { Client, Collection, CommandInteraction, Intents } from "discord.js";
import { RESTPostAPIApplicationCommandsJSONBody, Routes } from "discord.js/node_modules/discord-api-types";
import { Logger } from "winston";

export class Discord {
    constructor(logger: Logger, commandCollection: CommandCollection) {
        const client = new Client({ intents: Intents.FLAGS.GUILDS })
        const commands = commandCollection.GetList()

        const rest = new REST({ version: '9' });

        const commandRegister: RESTPostAPIApplicationCommandsJSONBody[] = [];
        commands.forEach(v => {
            commandRegister.push(v.data.toJSON())
        })

        async function RegistGuildCommand(applicationId: string, guildId: string) {
            await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: commandRegister })
        }

        client.once('ready', () => {
            console.log(`Logged in as ${client.user?.tag}!`);

            client.guilds.cache.forEach(async guild => {
                await RegistGuildCommand(client.application!.id, guild.id)
            })
        })

        client.on('guildCreate', async guild => {
            try {
                await RegistGuildCommand(client.application!.id, guild.id)
            } catch (e) {
                logger.error(e)
                await guild.leave()
            }
        })
        client.on('guildDelete', async guild => { })

        client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return
        
            const command = commands.get(interaction.commandName)
        
            if (!command) return
        
            try {
                await command.execute(interaction)
            } catch (error) {
                logger.error(error)
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true })
            }
        });

        this.GetClientInternal = () => {
            return client
        }
        this.LoginInternal = async (token) => {
            rest.setToken(token)
            return await client.login(token)
        }
    }

    private async InvokeUninitializedError(): Promise<any> { throw new Error("Class does not initialized.") }

    private GetClientInternal: () => Client = () => { throw new Error("Class does not initialized.") }
    public GetClient() { return this.GetClientInternal() }

    private LoginInternal: (token: string) => Promise<string> = this.InvokeUninitializedError 
    public async Login(token: string) {
        return await this.LoginInternal(token)
    }
}

export interface Command {
    data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">,
    execute(interaction: CommandInteraction): void,
}
export class CommandCollection {
    private CommandList = new Collection<string, Command>()

    public GetList() {
        return this.CommandList
    }
    public AddCommand(command: Command) {
        this.CommandList.set(command.data.name, command)
        return this
    }
}