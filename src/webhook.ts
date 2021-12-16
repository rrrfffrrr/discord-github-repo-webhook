import errors from 'http-errors'
import express, { NextFunction, Request, Response } from 'express'
import { verify, sign } from '@octokit/webhooks-methods'
import { Logger } from 'winston'
import { DB } from './db'

export class Webhook {
    constructor(logger: Logger, db: DB, callback: (guild: string, organization: string, body: any) => void) {
        const app = express()
            .use(express.json())
            .use('/webhook/:guildId/github', async (req, res, next) => {
                let guild: string = req.params.guildId
                let organization: string = req.body.organization.login
                
                try {
                    let secret = await db.GetSecret(guild, organization)
                    let payload = JSON.stringify(req.body, null, 2) + '\n'
            
                    let sig = await sign(secret, payload)
                    let valid = await verify(secret, payload, sig)
            
                    if (valid) {
                        callback(guild, organization, req.body)
                    } else {
                        throw new Error("Fail to verify payload")
                    }
                } catch (e) {
                    logger.error(JSON.stringify(e))
                    next(new errors[404])
                }
            })
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

        this.ListenInternal = (port, callback) => {
            logger.info(`Webhook: Start http server on ${port}`)
            app.listen(port, callback)
        }
    }

    private async InvokeUninitializedError(): Promise<any> { throw new Error("Class does not initialized.") }

    private ListenInternal: (port: number, callback?: () => void) => void = this.InvokeUninitializedError
    public Listen(port: number) {
        return new Promise<void>((resolve, reject) => {
            try {
                this.ListenInternal(port, () => { resolve() })
            } catch (e) {
                reject(e)
            }
        })
    }
}