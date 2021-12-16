import { createPool, PoolOptions } from 'mysql2'
import { Logger } from 'winston'

const LINK_TABLE_NAME = 'option_2829c680'
const DB_STATEMENT = {
    LINK: {
        CREATE_TABLE: `CREATE TABLE IF NOT EXISTS ${LINK_TABLE_NAME} (
            id INT PRIMARY KEY AUTO_INCREMENT,
            valid BOOLEAN,
            guild VARCHAR(32),
            organization VARCHAR(64),
            secret VARCHAR(128)
        );`,
        ADD: `INSERT INTO ${LINK_TABLE_NAME} (valid, guild, organization, secret) VALUES (true, ?, ?, ?)`,
        EXPIRE: `UPDATE ${LINK_TABLE_NAME} SET valid = false WHERE guild = ? AND organization = ?`,
        GET_SECRET: `SELECT secret FROM ${LINK_TABLE_NAME} WHERE guild = ? AND organization = ? AND valid IS TRUE`
    },
}

export class DB {
    constructor(config: PoolOptions, logger: Logger) {
        const DB = createPool(config)
        const DBPromise = DB.promise()
        
        this.CreateTableInternal = async () => {
            logger.info("DB: Generate tables")
            await DBPromise.execute(DB_STATEMENT.LINK.CREATE_TABLE)
            return true
        }
        this.AddInternal = async (guild, organization, secret) => {
            logger.info(`DB: Add link(${guild} - ${organization})`)
            await DBPromise.execute(DB_STATEMENT.LINK.ADD, [guild, organization, secret])
            return true
        }
        this.ExpireInternal = async (guild, organization) => {
            logger.info(`DB: Expire link(${guild} - ${organization})`)
            await DBPromise.execute(DB_STATEMENT.LINK.EXPIRE, [guild, organization])
            return true
        }
        this.GetSecretInternal = async (guild, organization) => {
            logger.info(`DB: Expire link(${guild} - ${organization})`)
            let [[result], [fields]] = await DBPromise.query(DB_STATEMENT.LINK.GET_SECRET, [guild, organization])
            return result.secret
        }
    }

    private async InvokeUninitializedError(): Promise<any> { throw new Error("Class does not initialized.") }

    private CreateTableInternal: () => Promise<true> = this.InvokeUninitializedError
    public async CreateTable() {
        await this.CreateTableInternal()
    }

    private AddInternal: (guild: string, organization: string, secret: string) => Promise<true> = this.InvokeUninitializedError
    public async Add(guild: string, organization: string, secret: string) {
        await this.AddInternal(guild, organization, secret)
    }

    private ExpireInternal: (guild: string, organization: string) => Promise<true> = this.InvokeUninitializedError
    public async Expire(guild: string, organization: string) {
        await this.ExpireInternal(guild, organization)
    }
    
    private GetSecretInternal: (guild: string, organization: string) => Promise<string> = this.InvokeUninitializedError
    public async GetSecret(guild: string, organization: string) {
        return await this.GetSecretInternal(guild, organization)
    }
}