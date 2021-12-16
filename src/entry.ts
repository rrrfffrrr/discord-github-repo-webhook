import { Subject } from 'rxjs'

import winston, { createLogger } from 'winston'
import { DiscordStream, OrganizationStream, RepositoryStream } from './data'

import { DB as DBClass} from './db'
import { Webhook as WebhookClass } from './webhook'
import { Discord as DiscordClass } from './discord'

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

//#region Subsystem callback
const Initializer: Promise<any>[] = []
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

Initializer.push(DB.CreateTable())
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
    Initializer.push(WEBHOOK.Listen(port))
}
//#endregion

//#region Discord
logger.info("Discord: Initialize")
const DISCORD = new DiscordClass(logger)

Initializer.push(DISCORD.Login(process.env.DISCORD_TOKEN))
//#endregion

//#region Entrypoint
Promise.all(Initializer).then(() => {
    logger.info("ENTRY: Server started")
}).catch(e => {
    logger.error(e)
    process.exit(1)
})
//#endregion