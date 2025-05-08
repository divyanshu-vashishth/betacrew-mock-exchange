# BetaCrew Exchange Client

A Node.js client application that connects to the BetaCrew Exchange server, receives stock ticker data, processes it, and writes the data to a JSON file.

## Prerequisites

* Node.js (version 16 or later)

## Usage

1. **Start the Exchange Server:**

```bash
node main.js
```

2. **Run the Client: concurrently**

```bash
node client.js
```

The client will connect to the exchange server, request all packets, handle any missing packets, and write the data to `exchange_data.json`.

## Output

* The output JSON file (`exchange_data.json`) will contain the stock ticker data in the order of packet sequences.
