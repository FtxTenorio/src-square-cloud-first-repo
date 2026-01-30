import { SlashCommandBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
          .setName('ping')
          .setDescription('Replies witg Pong!'),
    execute: async (interaction) => await interaction.reply('Pong!')
}