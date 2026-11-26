// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title FundBToken
 * @notice Fixed-supply FUNDB token for BNB Smart Chain (BEP-20 compatible).
 * @dev No owner, mint function, proxy, blacklist, tax, pause, or upgrade path.
 *      Deploy only after independent review and verify the source on BscScan.
 */
contract FundBToken is ERC20 {
    uint256 public constant INITIAL_SUPPLY = 10_000_000_000 * 10 ** 18;

    error InvalidInitialHolder();

    constructor(address initialHolder) ERC20("FundB", "FUNDB") {
        if (initialHolder == address(0)) revert InvalidInitialHolder();
        _mint(initialHolder, INITIAL_SUPPLY);
    }
}
