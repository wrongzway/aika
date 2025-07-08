const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const CONFIG = {
    BOT_INVITE: `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=268443710&scope=bot%20applications.commands`,
    REQUIRED_PERMISSIONS: new PermissionsBitField([
        'ViewChannel',
        'SendMessages',
        'ManageMessages',
        'ManageRoles',
        'CreateInstantInvite',
        'ReadMessageHistory'
    ])
};

// Initialize
try {
    const app = express();
    const PORT = process.env.PORT || 3000;
    
    // Token validation
    const BOT_TOKEN = process.env.DISCORD_TOKEN?.trim();
    if (!BOT_TOKEN || !BOT_TOKEN.startsWith('MT') || BOT_TOKEN.length < 59) {
        console.error('❌ Invalid bot token');
        process.exit(1);
    }

    // File paths
    const dataFile = path.join(__dirname, 'data.json');
    const logsFile = path.join(__dirname, 'logs.txt');

    // Data management
    function loadData() {
        if (!fs.existsSync(dataFile)) {
            const defaultData = {
                allies: [],
                enemies: [],
                displayChannelId: null,
                displayMessageId: null,
                guildInvites: {},
                adminIds: ['248827194091110410'], // Your ID inserted here
                adminRoleName: 'Bot Admin'
            };
            fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 4));
            return defaultData;
        }
        
        try {
            const loadedData = JSON.parse(fs.readFileSync(dataFile));
            // Ensure arrays exist
            if (!loadedData.allies) loadedData.allies = [];
            if (!loadedData.enemies) loadedData.enemies = [];
            if (!loadedData.adminIds) loadedData.adminIds = ['248827194091110410']; // Your ID here
            return loadedData;
        } catch (err) {
            console.error('Corrupt data file, resetting...', err);
            return loadData(); // Recursively reset
        }
    }

    function saveData(data) {
        try {
            fs.writeFileSync(dataFile, JSON.stringify(data, null, 4));
        } catch (err) {
            console.error('❌ Data save error:', err);
        }
    }

    // Discord client
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildInvites,
            GatewayIntentBits.GuildMembers
        ],
        partials: ['CHANNEL']
    });

    const prefix = '!';
    let data = loadData();
    let displayChannel = null;
    let displayMessage = null;

    // Update display
    async function updateDisplay() {
        if (displayChannel && displayMessage) {
            const content = `**Allies:** ${data.allies.join(', ') || 'None'}\n**Enemies:** ${data.enemies.join(', ') || 'None'}`;
            try {
                displayMessage = await displayMessage.edit(content);
                data.displayMessageId = displayMessage.id;
                saveData(data);
            } catch (err) {
                console.error('Display update failed:', err);
            }
        }
    }

    // Ready handler
    client.once('ready', () => {
        console.log(`✅ Logged in as ${client.user.tag}`);
        console.log(`🔗 Invite: ${CONFIG.BOT_INVITE}`);
    });

    // Command handler
    client.on('messageCreate', async (message) => {
        if (!message.content.startsWith(prefix) || message.author.bot) return;

        const args = message.content.slice(prefix.length).trim().split(/\s+/);
        const command = args.shift().toLowerCase();
        
        // Safe permission check
        const isAdmin = Array.isArray(data.adminIds) && 
                       (data.adminIds.includes(message.author.id) || 
                        message.member?.permissions.has(PermissionsBitField.Flags.Administrator));

        try {
            // Command: Add Ally
            if (command === 'add_ally' && isAdmin) {
                const name = args.join(' ');
                if (!name) return message.reply('Please provide a name.');
                if (!data.allies) data.allies = [];
                if (data.allies.includes(name)) return message.reply(`${name} is already an ally!`);
                
                data.allies.push(name);
                saveData(data);
                await updateDisplay();
                return message.reply(`Added ${name} to allies!`);
            }

            // Command: Add Enemy
            if (command === 'add_enemy' && isAdmin) {
                const name = args.join(' ');
                if (!name) return message.reply('Please provide a name.');
                if (!data.enemies) data.enemies = [];
                if (data.enemies.includes(name)) return message.reply(`${name} is already an enemy!`);
                
                data.enemies.push(name);
                saveData(data);
                await updateDisplay();
                return message.reply(`Added ${name} to enemies!`);
            }

            // Command: Remove Ally
            if (command === 'remove_ally' && isAdmin) {
                const name = args.join(' ');
                if (!name) return message.reply('Please provide a name to remove.');
                if (!data.allies || !data.allies.includes(name)) {
                    return message.reply(`${name} is not in the ally list!`);
                }
                
                data.allies = data.allies.filter(ally => ally !== name);
                saveData(data);
                await updateDisplay();
                return message.reply(`Removed ${name} from allies!`);
            }

            // Command: Remove Enemy
            if (command === 'remove_enemy' && isAdmin) {
                const name = args.join(' ');
                if (!name) return message.reply('Please provide a name to remove.');
                if (!data.enemies || !data.enemies.includes(name)) {
                    return message.reply(`${name} is not in the enemy list!`);
                }
                
                data.enemies = data.enemies.filter(enemy => enemy !== name);
                saveData(data);
                await updateDisplay();
                return message.reply(`Removed ${name} from enemies!`);
            }

            // Command: List Allies
            if (command === 'list_allies') {
                return message.reply(data.allies.length ? `Allies: ${data.allies.join(', ')}` : 'No allies yet!');
            }

            // Command: List Enemies
            if (command === 'list_enemies') {
                return message.reply(data.enemies.length ? `Enemies: ${data.enemies.join(', ')}` : 'No enemies yet!');
            }

            // Command: Set Display
            if (command === 'set_display' && isAdmin) {
                displayChannel = message.channel;
                displayMessage = await displayChannel.send('Initializing display...');
                data.displayChannelId = displayChannel.id;
                data.displayMessageId = displayMessage.id;
                saveData(data);
                await updateDisplay();
                return message.reply('Display channel set!');
            }

            // Command: Help
            if (command === 'help') {
                return message.reply([
                    '**Commands:**',
                    '`!add_ally <name>` - Add ally (Admin)',
                    '`!add_enemy <name>` - Add enemy (Admin)',
                    '`!remove_ally <name>` - Remove ally (Admin)',
                    '`!remove_enemy <name>` - Remove enemy (Admin)',
                    '`!list_allies` - Show allies',
                    '`!list_enemies` - Show enemies',
                    '`!set_display` - Setup display (Admin)',
                    '`!help` - This menu'
                ].join('\n'));
            }

        } catch (err) {
            console.error('Command error:', err);
            message.reply('Command failed. Check console.').catch(() => {});
        }
    });

    // Web server
    app.get('/', (req, res) => res.send('Bot online'));
    app.listen(PORT, () => console.log(`🌐 Web: http://localhost:${PORT}`));

    // Error handling
    process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));
    process.on('uncaughtException', err => console.error('Uncaught exception:', err));

    // Login
    client.login(BOT_TOKEN)
        .catch(err => {
            console.error('Login failed:', err);
            process.exit(1);
        });

} catch (err) {
    console.error('Fatal init error:', err);
    process.exit(1);
}
// Command: Tie Invite
if (command === 'tie_invite' && isAdmin) {
    const [allyName, inviteLink] = args;
    if (!allyName || !inviteLink) {
        return message.reply('Usage: !tie_invite <ally_name> <invite_link>');
    }

    if (!data.allies || !data.allies.includes(allyName)) {
        return message.reply(`${allyName} is not in the ally list.`);
    }

    const inviteMatch = inviteLink.match(/discord(?:\.gg|app\.com\/invite)\/([a-zA-Z0-9]+)/);
    if (!inviteMatch) {
        return message.reply('Invalid invite link format.');
    }

    const inviteCode = inviteMatch[1];

    if (!data.guildInvites) data.guildInvites = {};
    data.guildInvites[allyName] = inviteCode;
    saveData(data);

    return message.reply(`Tied invite \`${inviteCode}\` to ally \`${allyName}\`.`);
}
