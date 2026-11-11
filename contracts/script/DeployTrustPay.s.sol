// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TrustPay} from "../TrustPay.sol";

/**
 * @title DeployTrustPay
 * @notice Deploys TrustPay for Arc Mainnet (chain ID 5042). Run it yourself, from your own wallet.
 * @dev No private key lives in this file or in the repository. Pass your signer at the command line
 * with a Foundry keystore (`--account`) or a hardware wallet (`--ledger`). The script refuses to run
 * on any chain other than Arc Mainnet and refuses a USDC address with no code.
 *
 *   forge script contracts/script/DeployTrustPay.s.sol:DeployTrustPay \
 *     --rpc-url https://rpc.mainnet.arc.io --account <keystore-name> --broadcast
 *
 * Optional env var USDC_ADDRESS overrides the default Arc USDC (0x3600...0000).
 * After deploying, set VITE_TRUSTPAY_CONTRACT_ADDRESS in `.env`; no UI change is needed.
 */
contract DeployTrustPay is Script {
    uint256 internal constant ARC_MAINNET_CHAIN_ID = 5042;
    address internal constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    error WrongChain(uint256 actual);
    error UsdcHasNoCode(address usdc);

    function run() external returns (TrustPay trustPay) {
        if (block.chainid != ARC_MAINNET_CHAIN_ID) revert WrongChain(block.chainid);

        address usdc = vm.envOr("USDC_ADDRESS", ARC_USDC);
        if (usdc.code.length == 0) revert UsdcHasNoCode(usdc);

        vm.startBroadcast();
        trustPay = new TrustPay(IERC20(usdc));
        vm.stopBroadcast();

        console2.log("TrustPay deployed at:", address(trustPay));
        console2.log("USDC token:", usdc);
        console2.log("Set VITE_TRUSTPAY_CONTRACT_ADDRESS to the address above.");
    }
}
