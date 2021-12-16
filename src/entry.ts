import winston, { createLogger } from 'winston'

import { DB as DBClass} from './db'
import { Webhook as WebhookClass } from './webhook'
import { CommandCollection, Discord as DiscordClass } from './discord'
import { SlashCommandBuilder } from '@discordjs/builders'
import { CommandInteraction } from 'discord.js'
import { v4 } from 'uuid'
import { Octokit } from '@octokit/rest'

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
const WEBHOOK = new WebhookClass(logger, DB, async (guild, organization, body) => {
    switch(body.action) {
        case 'created':
            let categoryId = await DB.GetCategory(guild, organization)
            let client = DISCORD.GetClient()

            client.guilds.cache.get(guild)?.channels.create(body.name, {
                type: 'GUILD_TEXT',
            })
            let category = client.guilds.cache.get(guild)?.channels.cache.get(categoryId)

            if (category!.type === 'GUILD_CATEGORY') {
                category.
            }
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
        .addStringOption(option =>  option.setName('token').setDescription('A token of github organization to add webhook.'))
    ,
    async execute(interaction: CommandInteraction) {
        var organization = interaction.options.getString('organization')
        if (!organization) {
            return interaction.reply(`You must set target organization in order to automate webhook`)
        }

        var guild = interaction.guildId
        var secret = v4().replace('-', '')

        try {
            let category = await interaction.guild?.channels.create(organization, { type: 'GUILD_CATEGORY'})
            let token = interaction.options.getString('token', false)
            
            var github = new Octokit({ auth: token || undefined })
            let createResponse = await github.rest.orgs.createWebhook({
                name: 'web',
                org: organization,
                config: {
                    url: process.env.WEBHOOK_URL!,
                    secret: secret,
                    content_type: 'json'
                },
                events: ['repository'],
            })
            await DB.Add(guild, category!.id, organization, secret)

            let repoList = await github.repos.listForOrg({
                org: organization
            })

            repoList.data.forEach(async v => {
                CreateLink(guild, organization!, v.name, v.description || '')
            })
            
            return interaction.reply(`Your organization(${organization}) registed to automate channels`)
        } catch (e) {
            interaction.reply(`Fail to regist a organization.`)
        }
    },
})
const DISCORD = new DiscordClass(logger, DISCORD_COMMAND)

Initializer.push(async () => {
    if (!process.env.WEBHOOK_URL) {
        throw new Error(`DISCORD: WEBHOOK_URL not set!`)
    }
})
Initializer.push(async () => await DISCORD.Login(process.env.DISCORD_TOKEN || ''));
//#endregion

//#region Logic
async function CreateOrgHook(guild: string, organization: string, repoName: string, repoDescription: string) {
    let channel = await category?.createChannel(repoName, {
        type: 'GUILD_TEXT',
        topic: `${repoName} ${repoDescription}`
    })
    let discordHook = await channel?.createWebhook('Github')
    
    let hookResponse = await github.repos.createWebhook({
        repo: v.full_name,
        owner: interaction.applicationId,
        config: {
            url: `${discordHook!.url}/github`,
            content_type: 'json',
        }
    })
}
async function CreateRepoHook(guild: string, organization: string, repoName: string, repoDescription: string) {

}
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