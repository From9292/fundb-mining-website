import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { assertInitialHolder, INITIAL_HOLDER } from "../scripts/deploy-guards.js";

const { ethers } = await network.create();
const HOLDER = INITIAL_HOLDER;

describe("testnet deployment holder guard", function () {
  it("uses a valid EIP-55 checksum for the nominated holder", function () {
    assert.equal(ethers.getAddress(HOLDER), HOLDER);
  });

  it("accepts the nominated holder address regardless of hex letter casing", function () {
    assert.doesNotThrow(() => assertInitialHolder(HOLDER, HOLDER.toLowerCase()));
  });

  it("rejects a different deployment signer before any deployment transaction", function () {
    assert.throws(
      () => assertInitialHolder("0x0000000000000000000000000000000000000001", HOLDER),
      /must match the nominated initial token holder/
    );
  });

  it("rejects malformed signer or holder addresses", function () {
    assert.throws(() => assertInitialHolder("not-an-address", HOLDER), /valid EVM addresses/);
    assert.throws(() => assertInitialHolder(HOLDER, "0x1234"), /valid EVM addresses/);
  });
});
