import { Log, Wrap } from '../../logger'
import { CommandBlock } from '../dependency'
import { SlashCommandBuilder } from '@discordjs/builders';
import { Octokit } from '@octokit/rest';
import { MessageEmbed } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('set_github_token')
        .setDescription('Prepare discord auth token.')
        .addStringOption(option => option.setName('user').setRequired(true).setDescription('Github user profile'))
        .addStringOption(option => option.setName('access_token').setRequired(true).setDescription('Github access token'))
    ,
	async execute(interaction) {
        try {
            await interaction.deferReply({
                ephemeral: true
            });
        } catch (e) {
            Log.error({ message: `Cannot defer reply on a interaction.\n${e}`})    
        }

        const uid = interaction.user.id
        const profile = interaction.options.getString('user', true)
        const secret = interaction.options.getString('access_token', true)

        const github = new Octokit({
            auth: `token ${secret}`
        })

        let isAuthenticated = false 
        try {
            const auth = await github.rest.users.getAuthenticated()
            if (typeof auth.data.total_private_repos !== 'undefined') {
                isAuthenticated = true;
            }
        } catch (e) {
            Log.error(Wrap(e))
        }

        if (!isAuthenticated) {
            interaction.editReply({
                embeds: [
                    new MessageEmbed()
                        .setTitle('Fail!')
                        .setDescription(`Invalid token for "${profile}"`)
                        .setTimestamp()
                        .setFooter('https://github.com/rrrfffrrr')
                ]
            })
            return
        }

        // TODO: Save token here

        interaction.editReply({
            embeds: [
                new MessageEmbed()
                    .setTitle('Success!')
                    .setDescription(`You logged in as "${profile}"`)
                    .setTimestamp()
                    .setFooter('https://github.com/rrrfffrrr')
            ]
        })
    }
} as CommandBlock