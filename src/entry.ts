import { Client, Intents } from 'discord.js'
import * as rx from 'rxjs'

const discord = new Client({ intents: Intents.FLAGS.GUILDS })

discord.on('ready', () => {
    console.log(`Logged in as ${discord.user?.tag}!`);
})

discord.login("token")