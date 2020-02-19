# Gas Huffer
This contract extracts the `number, gasLimit, gasUsed` fields from encoded Ethereum block headers
and re-encodes them into `uint256[3]` ABI arrays.
For general information about RLP and a definition of how to encode or decode with RLP,
refer to https://github.com/ethereum/wiki/wiki/RLP#rlp-decoding

## Stack
We keep 2 values on the stack: `cd_ptr` and `mem_ptr`
- `cd_ptr` is the current position in calldata for decoding
- `mem_ptr` is the current position in memory to store the next decoded item

## Steps:
1. Identify prefix
First, we take the encoded data's prefix and find the corresponding macro for decoding it.
We get the prefix with calldataload(0) >> 248
For a block header, the payload will always be a "long list", meaning the prefix will be in the range [0xf8, 0xff].

2. Decode length
Once we identify the prefix, we will know the length of the list length.
We then store mem[mem_ptr] = calldataload(1) >> (256 - (list_length_length * 8))
and set the `cd_ptr` to `1 + list_length_length`

3. 

## Ethereum Block Header
```
type Header struct {
	ParentHash  bytes32 0xa0<parent> 33 bytes
	UncleHash   bytes32 0xa0<uncle> 33 bytes
	Coinbase    address 0x94<address> 21 bytes
	Root        bytes32 0xa0<root> 33 bytes
	TxHash      bytes32 0xa0<root> 33 bytes
	ReceiptHash bytes32 0xa0<root> 33 bytes
	Bloom       bytes   0xb90100<bloom> 259 bytes
	Difficulty  uint    ?
	Number      uint    ?
	GasLimit    uint    ?
	GasUsed     uint    ?
	Time        uint    ?
	Extra       bytes
	MixDigest   bytes
	Nonce       uint
}
```
We only care about the parentHash, gasLimit, gasUsed values


## RLP Rules
1. the data is a string if the range of the first byte (i.e. prefix) is [0x00, 0x7f],
and the string is the first byte itself exactly;

2. the data is a string if the range of the first byte is [0x80, 0xb7],
and the string whose length is equal to the first byte minus 0x80 follows the first byte;

3. the data is a string if the range of the first byte is [0xb8, 0xbf],
and the length of the string whose length in bytes is equal to the first byte
minus 0xb7 follows the first byte, and the string follows the length of the string;

4. the data is a list if the range of the first byte is [0xc0, 0xf7],
and the concatenation of the RLP encodings of all items of the list which
the total payload is equal to the first byte minus 0xc0 follows the first byte;

5. the data is a list if the range of the first byte is [0xf8, 0xff],
and the total payload of the list whose length is equal to the first byte
minus 0xf7 follows the first byte, and the concatenation of the RLP encodings
of all items of the list follows the total payload of the list;
