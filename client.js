const net = require('net');
const fs = require('fs');

const HOST = 'localhost';
const PORT = 3000;

const PACKET_SIZE = 17; 

function createRequestPayload(callType, resendSeq = 0) {
  const buffer = Buffer.alloc(2);
  buffer.writeInt8(callType, 0);  
  buffer.writeInt8(resendSeq, 1);
  return buffer;
}

function parsePacket(buffer) {
  if (buffer.length < PACKET_SIZE) {
    return null;
  }

  const symbol = buffer.slice(0, 4).toString('ascii').replace(/\0/g, '').trim();
  const buySellindicator = buffer.slice(4, 5).toString('ascii');
  const quantity = buffer.readInt32BE(5);
  const price = buffer.readInt32BE(9);
  const packetSequence = buffer.readInt32BE(13);

  return {
    symbol,
    buySellindicator,
    quantity,
    price,
    packetSequence
  };
}

async function runClient() {
  console.log('Connecting to BetaCrew Exchange Server...');
  
  const packets = [];
  let receivedSequences = new Set();
  let maxSequence = 0;
  
  await new Promise((resolve, reject) => {
    const client = new net.Socket();
    
    client.connect(PORT, HOST, () => {
      console.log('Connected to server. Requesting all packets...');
      const payload = createRequestPayload(1); 
      client.write(payload);
    });
    
    let buffer = Buffer.alloc(0);
    
    client.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      
      while (buffer.length >= PACKET_SIZE) {
        const packetBuffer = buffer.subarray(0, PACKET_SIZE);
        buffer = buffer.subarray(PACKET_SIZE);
        
        const packet = parsePacket(packetBuffer);
        if (packet) {
          packets.push(packet);
          receivedSequences.add(packet.packetSequence);
          maxSequence = Math.max(maxSequence, packet.packetSequence);
        }
      }
    });
    
    client.on('close', () => {
      console.log('Connection closed after receiving initial packets.');
      resolve();
    });
    
    client.on('error', (err) => {
      console.error('Error connecting to server:', err);
      reject(err);
    });
  });
  
  const missingSequences = [];
  for (let i = 1; i <= maxSequence; i++) {
    if (!receivedSequences.has(i)) {
      missingSequences.push(i);
    }
  }
  
  console.log(`Received ${packets.length} packets. Missing sequences: ${missingSequences.join(', ')}`);
  
  //request for each missing sequence
  for (const seq of missingSequences) {
    await new Promise((resolve, reject) => {
      const client = new net.Socket();
      
      client.connect(PORT, HOST, () => {
        console.log(`Requesting missing packet with sequence ${seq}...`);
        const payload = createRequestPayload(2, seq);
        client.write(payload);
      });
      
      let buffer = Buffer.alloc(0);
      
      client.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        
        if (buffer.length >= PACKET_SIZE) {
          const packetBuffer = buffer.subarray(0, PACKET_SIZE);
          const packet = parsePacket(packetBuffer);
          
          if (packet) {
            packets.push(packet);
            receivedSequences.add(packet.packetSequence);
            console.log(`Received missing packet with sequence ${packet.packetSequence}`);
          }
          
          client.end();
        }
      });
      
      client.on('close', () => {
        console.log(`Connection closed after receiving packet ${seq}.`);
        resolve();
      });
      
      client.on('error', (err) => {
        console.error(`Error requesting packet ${seq}:`, err);
        reject(err);
      });
    });
  }
  
  packets.sort((a, b) => a.packetSequence - b.packetSequence);
  
  fs.writeFileSync('exchange_data.json', JSON.stringify(packets, null, 2));
  console.log('All packets received and saved to exchange_data.json');
  
  const finalSequences = new Set(packets.map(p => p.packetSequence));
  const allPresent = Array.from({ length: maxSequence }, (_, i) => i + 1)
    .every(seq => finalSequences.has(seq));
    
  console.log(`All sequences present: ${allPresent ? 'Yes' : 'No'}`);
}

runClient().catch(err => {
  console.error('Client failed:', err);
}); 