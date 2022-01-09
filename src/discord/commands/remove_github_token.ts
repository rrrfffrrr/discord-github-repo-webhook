import { Log, Wrap } from '../../logger'
import { CommandBlock } from '../dependency'
import { SlashCommandBuilder } from '@discordjs/builders';
import { Octokit } from '@octokit/rest';
import { MessageEmbed } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('remove_github_token')
        .setDescription('Remove saved token.')
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

        // TODO: Remove token here

        interaction.editReply({
            embeds: [
                new MessageEmbed()
                    .setTitle('Success!')
                    .setDescription(`Your token has been removed.`)
                    .setTimestamp()
                    .setFooter('https://github.com/rrrfffrrr')
            ]
        })
    }
} as CommandBlock