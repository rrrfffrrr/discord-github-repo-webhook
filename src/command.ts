import { SlashCommandBuilder } from '@discordjs/builders'
import { Collection, CommandInteraction } from 'discord.js'
import { Subject } from 'rxjs'
import { DiscordStream } from './data'

export interface Command {
    data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">,
    execute(interaction: CommandInteraction): void,
}
export let Commands = new Collection<string, Command>()

function AddCommand(command: Command) {
    Commands.set(command.data.name, command)
}

export function GenerateCommandList(stream: Subject<DiscordStream>) {
    AddCommand({
        data: new SlashCommandBuilder()
            .setName('avatar')
            .setDescription('Get the avatar URL of the selected user, or your own avatar.')
            .addUserOption(option => 
                option.setName('target').setDescription('The user\'s avatar to show')
        ),
        async execute(interaction: CommandInteraction) {
            const user = interaction.options.getUser('target');
            if (user) return interaction.reply(`${user.username}'s avatar: ${user.displayAvatarURL({ dynamic: true })}`);
            return interaction.reply(`Your avatar: ${interaction.user.displayAvatarURL({ dynamic: true })}`);
        },
    })
}