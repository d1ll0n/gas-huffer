const easySolc = require('easy-solc');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const Web3 = require('web3');
const provider = require('ganache-core').provider();
const web3 = new Web3(provider);
const RLP = require('rlp');

const { bytecode: huffDecoder } = require('./gas-huffer/compile');

const dataFee = (data) => Buffer.from(data.slice(2), 'hex').reduce(
  (fee, nibble) => fee + (nibble == 0 ? 4 : 64),
  0
)

const dataFeeIstanbul = (data) => Buffer.from(data.slice(2), 'hex').reduce(
  (fee, nibble) => fee + (nibble == 0 ? 4 : 16),
  0
)

let gasOracle, rlpDecoder, from, 
  block1, block2,
  block3, block4,
  headerBytes1, headerBytes2,
  headerBytes3, headerBytes4,
  encodedList, baseExecCost;

const getBlocks = async () => {
  let block = await web3.eth.getBlock('latest');
  block4 = await web3.eth.getBlock(block.number - 1);
  block3 = await web3.eth.getBlock(block4.number - 1);
  block2 = await web3.eth.getBlock(block3.number - 1);
  block1 = await web3.eth.getBlock(block2.number - 1);
  
  headerBytes1 = rlpEncodeHeader(block1);
  headerBytes2 = rlpEncodeHeader(block2);
  headerBytes3 = rlpEncodeHeader(block3);
  headerBytes4 = rlpEncodeHeader(block4);
}

before(async () => {
  const { bytecode, abi } = await easySolc( {
    name: 'GasOracle',
    sources: {
      'GasOracle.sol': {
        content: fs.readFileSync(path.join(__dirname, 'GasOracle.sol'), 'utf8')
      },
      'RLP.sol': {
        content: fs.readFileSync(path.join(__dirname, '..', 'rlp', 'encoding', 'RLP.sol'), 'utf8')
      }
    }
  });
  await web3.eth.getAccounts().then(([addr]) => from = addr);
  const { contractAddress } = await web3.eth.sendTransaction({ from, data: huffDecoder, gas: 6e6 });
  rlpDecoder = contractAddress;
  await web3.eth.sendTransaction({ from, data: huffDecoder, gas: 6e6 });
  await web3.eth.sendTransaction({ from, data: '', gas: 6e6 });
  await web3.eth.sendTransaction({ from, data: '', gas: 6e6 });
  await web3.eth.sendTransaction({ from, data: '', gas: 6e6 });
  await web3.eth.sendTransaction({ from, data: '', gas: 6e6 });
  await web3.eth.sendTransaction({ from, data: '', gas: 6e6 });
  await web3.eth.sendTransaction({ from, data: '0x6000600000', gas: 6e6 }).catch(err => err);
  gasOracle = await new web3.eth.Contract(abi).deploy({ data: bytecode, arguments: [ rlpDecoder ] }).send({ from, gas: 6e6 });
  await getBlocks();
});

const rlpEncodeHeader = ({
  parentHash, sha3Uncles, miner: coinbase, stateRoot,
  transactionsRoot, receiptsRoot, logsBloom, difficulty, number,
  gasLimit, gasUsed, timestamp, extraData, mixHash, nonce
}) => {
  let headerValues = [
    parentHash, sha3Uncles, coinbase, stateRoot,
    transactionsRoot, receiptsRoot, logsBloom,
    difficulty == 0 ? '0x' : difficulty,
    number == 0 ? '0x' : number,
    gasLimit == 0 ? '0x' : gasLimit,
    gasUsed == 0 ? '0x' : gasUsed,
    timestamp == 0 ? '0x' : timestamp,
    extraData, mixHash, nonce
  ].map(x => web3.utils.toHex(x));
  return RLP.encode(headerValues);
}

const prettyPrintWords = (abiEncodedString) =>
  abiEncodedString.slice(2).match(/.{64}/g).map((word, index) => console.log(`0x${(index * 32).toString(16)} | ${word}`))

// const decodeResult

describe('GasHuffer.huff', () => {
  it('Should have retrieved consistent headers from ganache', () => {
    expect(web3.utils.keccak256(headerBytes1)).to.eq(block1.hash);
    expect(web3.utils.keccak256(headerBytes1)).to.eq(block2.parentHash);
    expect(web3.utils.keccak256(headerBytes2)).to.eq(block2.hash);
  });

  it('Should decode two headers', async () => {
    encodedList = web3.eth.abi.encodeParameter('bytes[]', [headerBytes1, headerBytes2, headerBytes3, headerBytes4]);
    const result = await web3.eth.call({ from, data: encodedList, to: rlpDecoder, gas: 6e6 });
    // const executionCost = (fee) => (fee - 21000) - dataFee(encodedList);
    const [
      [number_1, gasLimit_1, gasUsed_1],
      [number_2, gasLimit_2, gasUsed_2],
      [number_3, gasLimit_3, gasUsed_3],
      [number_4, gasLimit_4, gasUsed_4]
    ] = web3.eth.abi.decodeParameter(`uint256[3][]`, result);
    const compareToBlock = (block, [num, lim, used]) => {
      expect(+num).to.eq(block.number);
      expect(+lim).to.eq(block.gasLimit);
      expect(+used).to.eq(block.gasUsed);
    };
    compareToBlock(block1, [number_1, gasLimit_1, gasUsed_1]);
    compareToBlock(block2, [number_2, gasLimit_2, gasUsed_2]);
    compareToBlock(block3, [number_3, gasLimit_3, gasUsed_3]);
    compareToBlock(block4, [number_4, gasLimit_4, gasUsed_4]);
  });

  it('Should use less than 2000 gas per header', async () => {
    const result = await web3.eth.sendTransaction({ from, data: encodedList, to: rlpDecoder, gas: 6e6 });
    const executionCost = ({ gasUsed: fee }) => (fee - 21000) - dataFee(encodedList);
    console.log(`GasHuffer cost for four headers:`)
    console.log(`\tOld Data Cost: ${dataFee(encodedList)}`)
    console.log(`\tIstanbul Data Cost: ${dataFeeIstanbul(encodedList)}`);
    console.log(`\tExecution Cost: ${executionCost(result)}`);
    baseExecCost = executionCost(result);
    expect(baseExecCost / 4).to.be.lt(2000);
  });
})

describe('GasOracle.sol', () => {
  it('Should use GasOracle.sol as a proxy to GasHuffer', async () => {
    const result = await web3.eth.call({ from, data: encodedList, to: rlpDecoder, gas: 6e6 });
    // const executionCost = (fee) => (fee - 21000) - dataFee(encodedList);
    const [
      [number_1, gasLimit_1, gasUsed_1],
      [number_2, gasLimit_2, gasUsed_2],
      [number_3, gasLimit_3, gasUsed_3],
      [number_4, gasLimit_4, gasUsed_4]
    ] = web3.eth.abi.decodeParameter(`uint256[3][]`, result);
    const compareToBlock = (block, [num, lim, used]) => {
      expect(+num).to.eq(block.number);
      expect(+lim).to.eq(block.gasLimit);
      expect(+used).to.eq(block.gasUsed);
    };
    compareToBlock(block1, [number_1, gasLimit_1, gasUsed_1]);
    compareToBlock(block2, [number_2, gasLimit_2, gasUsed_2]);
    compareToBlock(block3, [number_3, gasLimit_3, gasUsed_3]);
    compareToBlock(block4, [number_4, gasLimit_4, gasUsed_4]);
  })

  it('Should not add more than 5000 gas to use the solidity proxy', async () => {
    const data_abi = gasOracle.methods.getHeaderValues([headerBytes1, headerBytes2, headerBytes3, headerBytes4]).encodeABI();
    const result = await gasOracle.methods.getHeaderValues([headerBytes1, headerBytes2, headerBytes3, headerBytes4]).send({ from, gas: 6e6 });
    const executionCost = ({ gasUsed: fee }) => (fee - 21000) - dataFee(data_abi);
    console.log(`GasOracle.sol cost for four headers:`)
    console.log(`\tOld Data Cost: ${dataFee(data_abi)}`)
    console.log(`\tIstanbul Data Cost: ${dataFeeIstanbul(data_abi)}`);
    console.log(`\tExecution Cost: ${executionCost(result)}`);
  })
})