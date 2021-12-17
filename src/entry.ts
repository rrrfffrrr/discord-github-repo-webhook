import { Log, Wrap } from './logger'

import { Client, Intents } from 'discord.js'
import { RegistCommand, Commands } from './discord'

;(async () => {
    //#region Discord
    Log.info("DISCORD: Initialize")
    const DISCORD = new Client({ intents: Intents.FLAGS.GUILDS })

    DISCORD.once('ready', async () => {
        console.log(`Logged in as ${DISCORD.user?.tag}!`);

        DISCORD.guilds.cache.forEach(guild => {
            RegistCommand(guild).catch(e => { Log.error(Wrap(e)) })
        })
    })

    DISCORD.on('guildCreate', async guild => {
        try {
            await RegistCommand(guild)
        } catch (e) {
            Log.error(Wrap(e))
            guild.leave().catch(e => Log.error(Wrap(e)))
        }
    })

    DISCORD.on('interactionCreate', async interaction => {
        if (!interaction.isCommand()) return;
    
        const command = Commands.get(interaction.commandName);
    
        if (!command) return;
    
        try {
            await command.execute(interaction);
        } catch (error) {
            Log.error(Wrap(error));
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    })
    
    DISCORD.login(process.env.DISCORD_TOKEN);
    //#endregion
})().then(() => {
    Log.info("ENTRY: Server started")
}).catch(e => {
    Log.error({ message: e })
    process.exit(1)
})