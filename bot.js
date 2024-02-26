const { Client, Intents, Collection } = require('discord.js');
const { CosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
const fs = require('fs');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

const token = process.env.BOT_ID; 

const rpcEndpoint = 'https://sei-m.rpc.n0ok.net/';// RPC of your choice
const excludeAddress = 'sei152u2u0lqc27428cuf8dx48k8saua74m6nql5kgvsu4rfeqm547rsnhy4y9';   // Exclude Pallet contract from output

const listOnlyAddresses = true;   // False adds token IDs to output
const listAllHolders = false;     // True includes duplicates



client.commands = new Collection();

const ownersCommand = {
  name: 'owners',
  description: 'Get owners for a given SEI contract address',
  options: [
    {
      name: 'address',
      type: 'STRING',
      description: 'The SEI contract address of the owners to get',
      required: true,
    },
	{
		name: 'starting_id',
		type: 'STRING',
		description: 'Starting token number to query',
		required: true,
	},
	{
		name: 'ending_id',
		type: 'STRING',
		description: 'Ending token number to query',
		required: true,
	},
	{
		name: 'batch_size',
		type: 'STRING',
		description: "How many token id's to query",
		required: true,
	},
	{
		name: 'save_file',
		type: 'STRING',
		description: 'Collection name or filename to save addresses to',
		required: true,
	},	
  ]
};

client.once('ready', async () => {
  console.log('Ready!');
  
  const data = [
    ownersCommand
  ];

  // This is for global command registration; for single guild, use client.guilds.cache.get('YOUR_GUILD_ID').commands.create(data)
  await client.application.commands.set(data);
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;
  
	const { commandName, options } = interaction;
  
	if (commandName === 'owners') {
	  const address = options.getString('address');
	  const start_id = parseInt(options.getString('starting_id'), 10); // Convert to integer
	  const end_id = parseInt(options.getString('ending_id'), 10); // Convert to integer
	  const size = parseInt(options.getString('batch_size'), 10); // Convert to integer
	  const filename = options.getString('save_file');
  
	  await interaction.deferReply();
	  const response = await queryTokenOwners(address, start_id, end_id, size, filename);
	  // Use the response with file directly
	  await interaction.editReply(response);
	}
  });

// Adapt your queryTokenOwners function to accept the address parameter and return a string response
async function queryTokenOwners(contractAddress, startTokenId, endTokenId, batchSize, filename) {
  const client = await CosmWasmClient.connect(rpcEndpoint);
  let owners = listAllHolders ? [] : new Set();

  for (let tokenId = startTokenId; tokenId <= endTokenId; tokenId += batchSize) {
    const promises = [];
    for (let id = tokenId; id < tokenId + batchSize && id <= endTokenId; id++) {
      console.log(`Preparing query for token ID ${id}`);
      promises.push(
        client.queryContractSmart(contractAddress, { owner_of: { token_id: id.toString() } })
          .then(result => {
            if (result.owner && result.owner !== excludeAddress) {
              if (listOnlyAddresses) {
                if (listAllHolders) {
                  owners.push(result.owner); // Add every instance of ownership.
                } else {
                  owners.add(result.owner); // Ensure unique owners only.
                }
              } else {
                owners[result.owner] = owners[result.owner] || [];
                owners[result.owner].push(id);
              }
            }
          })
          .catch(error => {
            console.error(`Error querying token ID ${id}:`, error.message);
          })
      );
    }

    await Promise.allSettled(promises);
    console.log(`Finished querying batch up to token ID ${tokenId + batchSize - 1}`);
  }

  let filePrefix = collectionName;
  if (listOnlyAddresses) {
    filePrefix += '_Unique_Addresses';
  }
  if (listAllHolders) {
    filePrefix += '_All_Addresses';
  }

  const fileName = `${filename}+{filePrefix}.txt`;

  if (listOnlyAddresses) {
    fs.writeFileSync(fileName, JSON.stringify(listAllHolders ? owners : [...owners], null, 2));
  } else {
    fs.writeFileSync(fileName, JSON.stringify(owners, null, 2));
  }
  console.log(`Output written to ${fileName}`);
  

  return { content: 'Here are the queried owners:', files: [fileName] }
}

client.login(token);
