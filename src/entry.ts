import winston, { createLogger } from 'winston'

import { Webhook as WebhookClass } from './webhook'
import { CategoryChannel, Client, Intents } from 'discord.js'

import Database from 'better-sqlite3'

import { sign, verify } from '@octokit/webhooks-methods'
import { Octokit } from '@octokit/rest'
import { existsSync, mkdirSync } from 'fs'

const OPTION_VERSION = 1
interface Option {
    version: number,
    categoryId?: string,
}

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
process.on('exit', () => logger.close())
//#endregion

//#region Query
const QUERY = {
    OPTION: {
        CREATE_TABLE: `CREATE TABLE IF NOT EXISTS option (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            json TEXT NOT NULL
        )`,
        UPDATE: `INSERT INTO option (json) VALUES (?)`,
        GET: `SELECT json FROM option ORDER BY id DESC LIMIT 1`,
        COUNT: `SELECT count(json) FROM option`,
    },
    REPOSITORY: {
        CREATE_TABLE: `CREATE TABLE IF NOT EXISTS repositories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            repository TEXT NOT NULL,
            channelId TEXT NOT NULL,
            githubWebHook INTEGER,
            discordWebHook TEXT NOT NULL
        )`,
        UPDATE: `INSERT INTO repositories (repository, channelId, githubWebHook, discordWebHook) VALUES (?, ?, ?, ?)`,
        GET: `SELECT channelId, githubWebHook, discordWebHook FROM repositories WHERE repository = ? ORDER BY id DESC LIMIT 1`
    },
}
//#endregion

let OPTION: Option = {
    version: OPTION_VERSION
}

;(async () => {
    if (!process.env.GITHUB_ORGANIZATION) {
        throw new Error("WEBHOOK: GITHUB_ORGANIZATION required but no value passed!")
    }
    if (!process.env.DISCORD_SERVERID) {
        throw new Error("WEBHOOK: DISCORD_SERVERID required but no value passed!")
    }

    //#region DB
    logger.info("DB: Initialize");
    {
        const dir = 'db/'
        if (!existsSync(dir)){
            mkdirSync(dir, { recursive: true });
        }
    }
    const DB = new Database('db/database.db')
    process.on('beforeExit', () => DB.close())
    
    DB.exec(QUERY.OPTION.CREATE_TABLE)
    DB.exec(QUERY.REPOSITORY.CREATE_TABLE)

    const PREPARED_QUERY = {
        OPTION: {
            UPDATE: DB.prepare(QUERY.OPTION.UPDATE),
            GET: DB.prepare(QUERY.OPTION.GET),
            COUNT: DB.prepare(QUERY.OPTION.COUNT),
        },
        REPOSITORY: {
            UPDATE: DB.prepare(QUERY.REPOSITORY.UPDATE),
            GET: DB.prepare(QUERY.REPOSITORY.GET),
        }
    }
    
    function GetOption(): Option {
        return JSON.parse(PREPARED_QUERY.OPTION.GET.get().json)
    }
    function SetOption(option: Option) {
        PREPARED_QUERY.OPTION.UPDATE.run(JSON.stringify(option))
    }
    function UpdateRepository(repository: string, channelId: string, githubWebHook: number, discordWebHook: string) {
        PREPARED_QUERY.REPOSITORY.UPDATE.run(repository, channelId, githubWebHook, discordWebHook)
    }
    function GetRepository(repository: string) {
        let data = PREPARED_QUERY.REPOSITORY.GET.get(repository)
        if (data === undefined)
            return undefined
        return [data.channelId, data.githubWebHook, data.discordWebHook]
    }

    {
        let count = PREPARED_QUERY.OPTION.COUNT.get()
        if (count === undefined || count['count(json)'] < 1) {
            SetOption(OPTION)
        } else {
            OPTION = GetOption()
        }
    }
    //#endregion

    //#region Github
    logger.info("GITHUB: Initialize")
    const GITHUB = new Octokit({
        auth: `token ${process.env.GITHUB_ACCESS_TOKEN!}`
    })
    //#endregion

    //#region Discord
    logger.info("DISCORD: Initialize")
    const DISCORD = new Client({ intents: Intents.FLAGS.GUILDS })

    DISCORD.once('ready', async () => {
        console.log(`Logged in as ${DISCORD.user?.tag}!`);

        let guild = DISCORD.guilds.cache.get(process.env.DISCORD_SERVERID!)
        if (!guild)
            throw new Error('DISCORD: Application is not member of guild!')

        if (!OPTION.categoryId) {
            let name = `Github - ${process.env.GITHUB_ORGANIZATION}`
            let category = await guild.channels.create(name, {
                type: 'GUILD_CATEGORY',
            })
            OPTION.categoryId = category.id
            SetOption(OPTION)
        }

        let org = await GITHUB.rest.orgs.get({
            org: process.env.GITHUB_ORGANIZATION!,
        })
        let repoCount = (org.data.total_private_repos || 0) + (org.data.total_private_repos || 0)
        let cursor = 0
        let perPage = 100
        let page = 1
        while(cursor < repoCount) {
            let repos = await GITHUB.rest.repos.listForOrg({
                org: process.env.GITHUB_ORGANIZATION!,
                page: page,
                per_page: perPage
            })
            
            repos.data.forEach(async v => {
                try {
                    if (GetRepository(v.name)) { // pass if exists
                        RemoveGithubDiscordLink(v.name)
                        return
                    }

                    if (v.archived) {
                        return
                    }

                    GenerateGithubDiscordLink(v.name, `${v.html_url} ${v.description}`)
                } catch (e) {
                    logger.error(`DISCORD: Fail to create link with ${v.name}`)
                }
            })

            cursor += perPage
            page++
        }
    })

    DISCORD.login(process.env.DISCORD_TOKEN);
    //#endregion

    //#region Logic
    async function GenerateGithubDiscordLink(repository: string, description: string) {
        let data = GetRepository(repository)
        if (data !== undefined)
            return

        logger.info(`Generate link for ${repository}`)
        let guild = DISCORD.guilds.cache.get(process.env.DISCORD_SERVERID!)!

        let channel = await guild.channels.create(repository, {
            type: 'GUILD_TEXT',
            topic: description,
            parent: OPTION.categoryId,
        })

        let discordHook = await channel.createWebhook('Github')
        let githubHook = await GITHUB.rest.repos.createWebhook({
            owner: process.env.GITHUB_ORGANIZATION!,
            repo: repository,
            config: {
                content_type: 'json',
                url: `${discordHook.url}/github`
            },
            events: ["*"]
        })

        UpdateRepository(repository, channel.id, githubHook.data.id, discordHook.id)
    }
    async function RemoveGithubDiscordLink(repository: string) {
        let data = GetRepository(repository)
        if (data === undefined)
            return
        
        logger.info(`Remove link for ${repository}`)
        let [channelId, githubWebHook, discordWebHook] = data

        try {
            await GITHUB.rest.repos.deleteWebhook({
                owner: process.env.GITHUB_ORGANIZATION!,
                repo: repository,
                hook_id: githubWebHook
            })
        } catch {
            
        }
        
        let guild = DISCORD.guilds.cache.get(process.env.DISCORD_SERVERID!)!
        try {
            guild.channels.cache.get(channelId)?.delete()
        } catch {
            
        }
    }
    //#endregion

    //#region Webhook receiver
    logger.info("WEBHOOK: Initialize")
    const WEBHOOK = new WebhookClass(logger, async (req, res, next) => {
        try {
            let guildId = req.params.guildId

            if (process.env.DISCORD_SERVERID! !== guildId) {
                throw new Error('WEBHOOK: Guild id does not match!')
            }

            let valid = true
            let secret = process.env.GITHUB_SECRET
            if (secret) {
                let payload = JSON.stringify(req.body) + '\n'
                let sig = await sign(secret, payload)
                valid = await verify(secret, payload, sig)
            }

            if (!valid) {
                throw new Error('WEBHOOK: Invalid signature!')
            }

            if (!req.body.organization || !req.body.organization.login || req.body.organization.login !== process.env.GITHUB_ORGANIZATION) {
                throw new Error(`WEBHOOK: Wrong organization packet!: ${req.body.organization.login}`)
            }

            if (req.body.action === 'created') {
                await GenerateGithubDiscordLink(req.body.repository.name, `${req.body.repository.html_url} ${req.body.repository.description}`)
            }

            res.sendStatus(204)
        } catch (e) {
            logger.error(e)
            next()
        }
    })

    {
        let port = parseInt(process.env.WEBHOOK_PORT || '8080')
        if (isNaN(port))
            port = 8080
        await WEBHOOK.Listen(port)
    }
    //#endregion
})().then(() => {
    logger.info("ENTRY: Server started")
}).catch(e => {
    logger.error(e)
    process.exit(1)
})