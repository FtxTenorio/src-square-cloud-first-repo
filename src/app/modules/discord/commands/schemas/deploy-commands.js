import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
// Grab all the command folders from the commands directory you created earlier
const commandsPath = path.join(__dirname, '../utility');

const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
console.log('commands path', commandsPath)
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    console.log('file path', filePath)
    const command = await (await import(filePath)).default;
    console.log(command)
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}

const [token, clientId, guildId] = [process.env.DISCORD_SECRET_KEY, process.env.DISCORD_CLIENT_ID, '1466601421339234417']

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
	try {
        if(commands.length === 0) {
            throw new Error('There\'s no commands!')
        }
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();