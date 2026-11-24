export function assertInitialHolder(deployerAddress, initialHolder) {
  const addressPattern = /^0x[0-9a-fA-F]{40}$/;
  if (!addressPattern.test(String(deployerAddress || "")) ||
      !addressPattern.test(String(initialHolder || ""))) {
    throw new Error("Deployment signer and initial holder must be valid EVM addresses.");
  }
  if (String(deployerAddress).toLowerCase() !== String(initialHolder).toLowerCase()) {
    throw new Error("Deployment signer must match the nominated initial token holder.");
  }
}
