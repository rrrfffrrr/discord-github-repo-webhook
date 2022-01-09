import { Log, Wrap } from '../../logger'
import { CommandBlock } from '../dependency'
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChannelType } from 'discord-api-types'
import { Octokit } from '@octokit/rest';
import { MessageEmbed } from 'discord.js';

// TODO: Can be added to exists channel
export default {
	data: new SlashCommandBuilder()
		.setName('add_repo')
		.setDescription('Create new text channel that hooked with github repo')
        .addStringOption(option => option.setName('repo').setRequired(true).setDescription('Target repository name\nex) example/repo'))
        .addStringOption(option => option.setName('access_token').setRequired(true).setDescription('Github access token that have webhook management permission of target repo'))
        .addChannelOption(option => option.setName('category').setRequired(false).setDescription('A category the new channel will belong to').addChannelType(ChannelType.GuildCategory))
    ,
	async execute(interaction) {
        try {
            await interaction.deferReply({
                ephemeral: true
            });
        } catch (e) {
            Log.error({ message: `Cannot defer reply on a interaction.\n${e}`})    
        }
        try {
            const guild = interaction.guild!
            const repo = interaction.options.getString('repo', true)
            const secret = interaction.options.getString('access_token', true)
            const parent = interaction.options.getChannel('category', false)
            
            if (parent && parent.type !== 'GUILD_CATEGORY') {
                await interaction.editReply({
                    content: 'Category option must be category channel.'
                })
                return
            }

            const github = new Octokit({
                auth: `token ${secret}`
            })

            try {
                const [orgs, repos] = repo.split('/')
                let check = await github.rest.repos.get({
                    owner: orgs,
                    repo: repos,
                })

                try {
                    let channel = await guild.channels.create(repo, {
                        type: 'GUILD_TEXT',
                        topic: `${check.data.html_url} ${check.data.description}`,
                        parent: parent ? parent.id : undefined,
                    })
                    try {
                        let hook = await channel.createWebhook('Github')
                        try {
                            await github.rest.repos.createWebhook({
                                owner: orgs,
                                repo: repo,
                                config: {
                                    url: `${hook.url}/github`,
                                    content_type: 'json',
                                },
                                events: ['*'],
                            })

                            try {
                                await interaction.editReply({
                                    embeds: [
                                        new MessageEmbed()
                                            .setTitle('Success!')
                                            .setDescription(`<#${channel.id}> created and linked with [${check.data.full_name}](${check.data.html_url})`)
                                            .setTimestamp()
                                            .setFooter('https://github.com/rrrfffrrr')
                                    ]
                                });
                            } catch (e) {
                                Log.error(Wrap(e))
                            }
                        } catch (e) {
                            Log.error(Wrap(e))
                            channel.delete('Fail to link webhook').catch(e => { Log.error(Wrap(e)) })
                            await interaction.editReply('Cannot create webhook on the repository.')
                        }
                    } catch (e) {
                        Log.error(Wrap(e))
                        channel.delete('Fail to create webhook').catch(e => { Log.error(Wrap(e)) })
                        await interaction.editReply('Cannot create webhook from the channel.')
                    }
                } catch (e) {
                    Log.error(Wrap(e))
                    await interaction.editReply('Cannot create channels on this server.')
                }
            } catch (e) {
                Log.error(Wrap(e))
                await interaction.editReply('Invalid token.')
            }
        } catch (e) {
            Log.error(Wrap(e))
            await interaction.editReply({
                content: '500: Fail to run command.',
            })
        }
	},
} as CommandBlock;
