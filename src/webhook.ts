import errors from 'http-errors'
import express, { NextFunction, Request, Response } from 'express'
import { Logger } from 'winston'

export class Webhook {
    constructor(logger: Logger, callback: (req: Request, res: Response, next: NextFunction) => void) {
        const app = express()
            .use(express.json())
            .use('/webhook/:guildId/github', callback)
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