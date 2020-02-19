pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;
import "../lib/rlp/encoding/RLP.sol";

contract GasOracle {
  using RLP for *;
  address headerDecoder;
  constructor(address _headerDecoder) public payable {
    headerDecoder = _headerDecoder;
  }

  struct Result {
    uint256 blockNumber;
    uint256 gasLimit;
    uint256 gasUsed;
  }

  function getHeaderValues(bytes[] calldata headers)
  external view returns(/* uint256[3][] */Result[] memory results) {
    assembly {
      let freePtr := mload(0x40)
      let byteSize := sub(calldatasize(), 0x04)
      let itemCount := calldataload(0x24)
      calldatacopy(freePtr, 0x04, byteSize)
      let success := staticcall(
        gas(), sload(headerDecoder_slot),
        freePtr, byteSize,
        0, 0
      )
      returndatacopy(freePtr, 0, returndatasize())
      if iszero(success) { revert(0, returndatasize()) }
      return(freePtr, returndatasize())
    }
  }

  function proveHeader(bytes calldata data) external returns(uint256 field1, uint256 field2) {
    bytes memory info = data;
    RLP.Walker memory walker = info.fromRlp();
    walker.enterListSelf();
    // field1 = walker.readWord();
    walker.walk();
    walker.walkMulti(8);
    uint256 gasLimit = uint256(walker.readWord());
    walker.walk();
    uint256 gasUsed = uint256(walker.readWord());
    return (gasLimit, gasUsed);
  }
}
