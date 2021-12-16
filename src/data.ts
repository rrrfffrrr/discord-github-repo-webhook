export interface RepositoryStream {
    guild: string,
    organization: string,
    repository: string,
    action: 'created' | 'deleted',
}

export interface OrganizationStream {
    guild: string,
    organization: string,
    secret: string,
    action: 'add' | 'remove',
}

export interface DiscordStream {

}