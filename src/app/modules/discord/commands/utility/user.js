import { SlashCommandBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
          .setName('user')
          .setDescription('Provides information about the user.'),
    execute: async (interaction) => await interaction.reply(`This command was run by ${interaction.user.username}, who joined on ${interaction.member.joinedAt}.`),
}