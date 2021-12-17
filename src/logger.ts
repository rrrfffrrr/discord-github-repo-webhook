import winston, { createLogger } from 'winston'

export const Log = createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'logs/server.log', format: winston.format.json() })
    ]
})
if (process.env.NODE_ENV === 'development') {
    Log.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}
Log.info('LOG: log created')
process.on('exit', () => {
    Log.info('LOG: log close')
    Log.close()
})

export function Wrap(error: any) {
    return { message: error }
}