import { Client, Intents } from "discord.js";
import { Logger } from "winston";

export class Discord {
    constructor(logger: Logger) {
        GenerateCommandList(STREAM.DISCORD)

        const client = new Client({ intents: Intents.FLAGS.GUILDS })

        client.once('ready', () => {
            console.log(`Logged in as ${client.user?.tag}!`);
        })

        client.on('guildCreate', async guild => {
            try {
                await RegistGuildCommand(discord.application!.id, guild.id)
            } catch (e) {
                logger.error(e)
                await guild.leave()
            }
        })
        client.on('guildDelete', async guild => { })

        client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return
        
            const command = Commands.get(interaction.commandName)
        
            if (!command) return
        
            try {
                await command.execute(interaction)
            } catch (error) {
                logger.error(error)
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true })
            }
        });

        this.LoginInternal = async (token) => {
            return await client.login(token)
        }
    }

    private async InvokeUninitializedError(): Promise<any> { throw new Error("Class does not initialized.") }
    private LoginInternal: (token?: string) => Promise<string> = this.InvokeUninitializedError 
    public async Login(token?: string) {
        return await this.LoginInternal(token)
    }
}