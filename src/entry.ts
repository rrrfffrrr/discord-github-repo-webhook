import { filter, Subject } from 'rxjs'

import { Client, Intents } from 'discord.js'
import { RegistGuildCommand } from './deploy-command'
import { Commands, GenerateCommandList } from './command'

import { Octokit } from '@octokit/rest'
import { verify, sign } from '@octokit/webhooks-methods'

import errors from 'http-errors'
import express, { NextFunction, Request, Response } from 'express'

import { createPool } from 'mysql2'

import winston, { createLogger, debug } from 'winston'
import { DiscordStream, OrganizationStream, RepositoryStream } from './data'

import { v4 as uuid } from 'uuid'

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

//#region Rx
logger.info("STREAM: Initialize")
const STREAM = {
    ORGS: new Subject<OrganizationStream>(),
    REPO: new Subject<RepositoryStream>(),
    DISCORD: new Subject<DiscordStream>(),
}
//#endregion

//#region DB
logger.info("DB: Initialize")
const DB_STATEMENT = {
    LINK: {
        CREATE_TABLE: `CREATE TABLE IF NOT EXISTS option_2829c680 (
            id INT PRIMARY KEY AUTO_INCREMENT,
            valid BOOLEAN,
            guild VARCHAR(32),
            organization VARCHAR(64),
            secret VARCHAR(128)
        );`,
        ADD: `INSERT INTO option_2829c680 (valid, guild, organization, secret) VALUES (true, ?, ?, ?)`,
        EXPIRE: `UPDATE option_2829c680 SET valid = false WHERE guild = ? AND organization = ?`,
        GET_SECRET: `SELECT secret FROM option_2829c680 WHERE guild = ? AND organization = ? AND valid IS TRUE`
    },
}

const DB = createPool({
    connectionLimit : parseInt(process.env.DB_MAX_CONNECTION || "10"),
    host            : process.env.DB_HOST || "localhost",
    user            : process.env.DB_USER || "root",
    password        : process.env.DB_PASSWORD || "example",
    database        : process.env.DB_DATABASE || "db",
    port            : parseInt(process.env.DB_PORT || "3306")
})

const DBPromise = DB.promise()

logger.info("DB: Generate tables")
DBPromise.getConnection().then(async conn => {
    await conn.query(DB_STATEMENT.LINK.CREATE_TABLE)
    conn.release()

    logger.info("DB: Table generated")
})
//#endregion

//#region Webhook receiver
logger.info("WEBHOOK: Initialize")
async function HandleWebhook(req: Request, res: Response, next: NextFunction) {
    let guild: string = req.params.guildId
    let organization: string = req.body.organization.login

    try {
        let [[results], [fields]] = await DBPromise.query(DB_STATEMENT.LINK.GET_SECRET, [guild, organization])
        if (results === undefined) {
            throw new Error("Fail to find secret")
        }
        
        let secret = results.secret
        let payload = JSON.stringify(req.body, null, 2) + '\n'

        let sig = await sign(secret, payload)
        let valid = await verify(secret, payload, sig)

        if (valid) {
            switch(req.body.action) {
                case 'created':
                    STREAM.REPO.next({
                        action: 'created',
                        guild: guild,
                        organization: organization,
                        repository: req.body.repository.full_name
                    })
                    break
                case 'deleted':
                    STREAM.REPO.next({
                        action: 'deleted',
                        guild: guild,
                        organization: organization,
                        repository: req.body.repository.full_name
                    })
                    break
            }
        } else {
            throw new Error("Fail to verify payload")
        }
    } catch (e) {
        logger.error(JSON.stringify(e))
        next(new errors[404])
    }

}

const app = express()
    .use(express.json())
    .use('/webhook/:guildId/github', HandleWebhook)
    .use((req, res, next) => {
        next(new errors[404]);
    })
    .use((err: { message: any; status: any }, req: { app: { get: (arg0: string) => string } }, res: { locals: { message: any; error: any }; status: (arg0: any) => void; render: (arg0: string) => void }, next: any) => {
        // set locals, only providing error in development
        res.locals.message = err.message;
        res.locals.error = process.env.NODE_ENV === 'development' ? err : {};

        // render the error page
        res.status(err.status || 500);
        res.render('error');
    })
//#endregion

//#region Github
/*
const octokit = new Octokit({
})
octokit.repos.listForOrg({
    org: GITHUB.ORGANIZATION
}).then((res) => {
    console.log(JSON.stringify(res))
})

if (false) {
octokit.orgs.createWebhook({
    org: GITHUB.ORGANIZATION,
    name: "web",
    config: {
        url: "url here",
        content_type: "json",
    }
}).then(res => {
    console.log(JSON.stringify(res))
})
}*/
//#endregion

//#region Discord
logger.info("Discord: Initialize")
const discord = new Client({ intents: Intents.FLAGS.GUILDS })

discord.once('ready', () => {
    console.log(`Logged in as ${discord.user?.tag}!`);
})

discord.on('guildCreate', async guild => {
    try {
        await RegistGuildCommand(discord.application!.id, guild.id)
    } catch (e) {
        logger.error(e)
        await guild.leave()
    }
})
discord.on('guildDelete', async guild => { })

discord.on('interactionCreate', async interaction => {
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

GenerateCommandList(STREAM.DISCORD)
//#endregion

//#region Entrypoint
{
    logger.info("ENTRY: Start server")
    let port = process.env.WEBHOOK_PORT || 8080
    app.listen(port, () => {
        console.log(`Web server(${port}) started`)
    })
    discord.login(process.env.DISCORD_TOKEN).then(res => {
        console.log(res)
    })
}
//#endregion