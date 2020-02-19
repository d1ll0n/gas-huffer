const Web3 = require('web3')
const provider = require('ganache-core').provider();
const web3 = new Web3(provider);


// let d = web3.eth.abi.encodeParameter('uint256[][]', [[1,1,1], [2,2,2], [3,3,3]])
// d.slice(2).match(/.{64}/g).map((word, index) => console.log(`0x${(index * 32).toString(16)} | ${word}`))
const prettyPrintWords = (abiEncodedString) =>
  abiEncodedString.slice(2).match(/.{64}/g)
    .map((word, index) => console.log(
      `0x${(index * 32).toString(16)} | ${word}`
    ))

const abi = {
  components: [{
    inernalType: 'uint8',
    name: 'opcode',
    type: 'uint8'
  }, {
    internalType: 'bytes',
    name: 'metadata',
    type: 'bytes'
  }],
  internalType: 'struct FraudProofData',
  name: 'fraudProofData',
  type: 'tuple'
}

const data = web3.eth.abi.encodeParameter(abi, [[1, '0xaaabbb'], [10, '0xddccff']])
prettyPrintWords(data)