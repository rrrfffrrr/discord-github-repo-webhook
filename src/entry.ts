import winston, { createLogger } from 'winston'
import { DiscordStream, OrganizationStream, RepositoryStream } from './data'

import { DB as DBClass} from './db'
import { Webhook as WebhookClass } from './webhook'
import { CommandCollection, Discord as DiscordClass } from './discord'
import { SlashCommandBuilder } from '@discordjs/builders'
import { CommandInteraction } from 'discord.js'
import { v4 } from 'uuid'

//#region Logger
const logger = createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'logs/server.log', format: winston.format.json() })
    ]
})
if (process.env.NODE_ENV === 'development') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}
//#endregion

//#region Subsystem callback
const Initializer: (() => Promise<any>)[] = []
//#endregion

//#region DB
logger.info("DB: Initialize")
const DB = new DBClass({
    connectionLimit : parseInt(process.env.DB_MAX_CONNECTION || "10"),
    host            : process.env.DB_HOST || "localhost",
    user            : process.env.DB_USER || "root",
    password        : process.env.DB_PASSWORD || "example",
    database        : process.env.DB_DATABASE || "db",
    port            : parseInt(process.env.DB_PORT || "3306")
},logger)

Initializer.push(async () => await DB.CreateTable())
//#endregion

//#region Webhook receiver
logger.info("WEBHOOK: Initialize")
const WEBHOOK = new WebhookClass(logger, DB, (guild, organization, body) => {
    switch(body.action) {
        case 'created':
            STREAM.REPO.next({
                action: 'created',
                guild: guild,
                organization: organization,
                repository: body.repository.full_name
            })
            break
        case 'deleted':
            STREAM.REPO.next({
                action: 'deleted',
                guild: guild,
                organization: organization,
                repository: body.repository.full_name
            })
            break
    }
})

{
    let port = parseInt(process.env.WEBHOOK_PORT || '8080')
    if (isNaN(port))
        port = 8080
    Initializer.push(async () => await WEBHOOK.Listen(port))
}
//#endregion

//#region Discord
logger.info("Discord: Initialize")
const DISCORD_COMMAND = new CommandCollection()
DISCORD_COMMAND.AddCommand({
    data: new SlashCommandBuilder()
        .setName('regist')
        .setDescription('Regist github organization to create channels automatically.')
        .addStringOption(option =>  option.setName('organization').setRequired(true).setDescription('A target organization to generate channels.'))
    ,
    async execute(interaction: CommandInteraction) {
        var organization = interaction.options.getString('organization')
        if (organization === null) {
            return interaction.reply(`You must set target organization in order to automate webhook`)
        }

        var guild = interaction.guildId
        var secret = v4().replace('-', '')

        try {
            let category = await interaction.guild?.channels.create(organization, { type: 'GUILD_CATEGORY'})
            await DB.Add(guild, category!.id, organization, secret)
            
            return interaction.reply(`Your organization(${organization}) channels will be shown soon`)
        } catch (e) {

        }
    },
})
const DISCORD = new DiscordClass(logger, DISCORD_COMMAND)

Initializer.push(async () => await DISCORD.Login(process.env.DISCORD_TOKEN || ''));
//#endregion

//#region Entrypoint
(async function() {
    for (let i = 0; i < Initializer.length; i++) {
        const element = Initializer[i];
        await element()
    }
})().then(() => {
    logger.info("ENTRY: Server started")
}).catch(e => {
    logger.error(e)
    process.exit(1)
})
//#endregion