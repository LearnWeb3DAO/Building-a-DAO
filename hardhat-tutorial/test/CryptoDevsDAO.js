const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

async function deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist() {
  const [ownerWithNft, otherAccount] = await ethers.getSigners();

  const maxWhitelistedAddresses = 25
  const Whitelist = await ethers.getContractFactory("Whitelist");
  const whitelist = await Whitelist.deploy(maxWhitelistedAddresses);

  // add wallet to whitelist
  await whitelist.addAddressToWhitelist()

  const baseURI= 'www.test.com'
  const CryptoDevs = await ethers.getContractFactory("CryptoDevs");
  const cryptoDevs = await CryptoDevs.deploy(baseURI, whitelist.address);

  // start nft pre sale
  await cryptoDevs.startPresale()
  await cryptoDevs.presaleMint({value: ethers.utils.parseEther("0.01")})

  const FakeNFTMarketplace = await ethers.getContractFactory("FakeNFTMarketplace");
  const fakeNFTMarketplace = await FakeNFTMarketplace.deploy();

  const CryptoDevsDAO = await ethers.getContractFactory("CryptoDevsDAO");
  const cryptoDevsDAO = await CryptoDevsDAO.deploy(fakeNFTMarketplace.address, cryptoDevs.address, {
    value: ethers.utils.parseEther("0.1"),
  });

  return { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount };
}

describe("CryptoDevsDAO createProposal", function () {

  it('Should be able to create a proposal', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);

    const numProposal = await cryptoDevsDAO.createProposal(1)

    expect(numProposal.value).to.be.equal(ethers.BigNumber.from(0));  

    const proposal = await cryptoDevsDAO.proposals(numProposal.value)

    expect(proposal.nftTokenId).to.be.equal(ethers.BigNumber.from(1));
    expect(proposal.yayVotes).to.be.equal(ethers.BigNumber.from(0));
    expect(proposal.nayVotes).to.be.equal(ethers.BigNumber.from(0));  
    expect(proposal.executed).to.be.equal(false);  

  })

  it('Should not be able to create a proposal if doesnt hold a NFT', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);

    await expect(cryptoDevsDAO.connect(otherAccount).createProposal(1)).to.be.revertedWith("NOT_A_DAO_MEMBER");
  })

  it('Should not be able to create a proposal if NFT is not available', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);

    // buy NFT token 1 before
    await fakeNFTMarketplace.purchase(1, {
      value: ethers.utils.parseEther("0.1"),
    })

    await expect(cryptoDevsDAO.createProposal(1)).to.be.revertedWith("NFT_NOT_FOR_SALE");
  })
})

describe("CryptoDevsDAO voteOnProposal", function () {

  it('Should be able to vote YAY on a proposal', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);
    const numProposal = await cryptoDevsDAO.createProposal(1)

    // 0 means YAY
    await cryptoDevsDAO.voteOnProposal(numProposal.value, 0)
    const proposal = await cryptoDevsDAO.proposals(numProposal.value)
    expect(proposal.yayVotes).to.be.equal(ethers.BigNumber.from(1));
    expect(proposal.nayVotes).to.be.equal(ethers.BigNumber.from(0));  

  })

  it('Should be able to vote NAY on a proposal', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);
    const numProposal = await cryptoDevsDAO.createProposal(1)

    // 1 means NAY
    await cryptoDevsDAO.voteOnProposal(numProposal.value, 1)
    const proposal = await cryptoDevsDAO.proposals(numProposal.value)
    expect(proposal.yayVotes).to.be.equal(ethers.BigNumber.from(0));
    expect(proposal.nayVotes).to.be.equal(ethers.BigNumber.from(1));  
  })

  it('Should not be able to vote 2x', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);
    const numProposal = await cryptoDevsDAO.createProposal(1)
    await cryptoDevsDAO.voteOnProposal(numProposal.value, 0)

    await expect(cryptoDevsDAO.voteOnProposal(numProposal.value, 0)).to.be.revertedWith("ALREADY_VOTED");
  })

  it('Should not be able to vote if doesnt hold a NFT', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);
    const numProposal = await cryptoDevsDAO.createProposal(1)

    await expect(cryptoDevsDAO.connect(otherAccount).voteOnProposal(numProposal.value, 0)).to.be.revertedWith("NOT_A_DAO_MEMBER");
  })

  it('Should not be able to vote after deadline', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);
    const numProposal = await cryptoDevsDAO.createProposal(1)

    const SIX_MINUTES_IN_SECS = 6 * 60
    const votePeriodEnd = (await time.latest()) + SIX_MINUTES_IN_SECS;
    await time.increaseTo(votePeriodEnd);

    await expect(cryptoDevsDAO.voteOnProposal(numProposal.value, 0)).to.be.revertedWith("DEADLINE_EXCEEDED");
  })
})


describe("CryptoDevsDAO executeProposal", function () {

  it('Should be able to execute executeProposal where NAY wins', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);
    const numProposal = await cryptoDevsDAO.createProposal(1)

    // 1 means NAY
    await cryptoDevsDAO.voteOnProposal(numProposal.value, 1)

    const SIX_MINUTES_IN_SECS = 6 * 60
    const votePeriodEnd = (await time.latest()) + SIX_MINUTES_IN_SECS;
    await time.increaseTo(votePeriodEnd);

    await cryptoDevsDAO.executeProposal(numProposal.value)

    const proposal = await cryptoDevsDAO.proposals(numProposal.value)
    expect(proposal.executed).to.be.equal(true)
  })

  it('Should be able to execute executeProposal where YAY wins', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);
    const numProposal = await cryptoDevsDAO.createProposal(1)

    // 1 means YAY
    await cryptoDevsDAO.voteOnProposal(numProposal.value, 0)

    const SIX_MINUTES_IN_SECS = 6 * 60
    const votePeriodEnd = (await time.latest()) + SIX_MINUTES_IN_SECS;
    await time.increaseTo(votePeriodEnd);

    await cryptoDevsDAO.executeProposal(numProposal.value)

    // as the proposal was passed, we need to verify if the nft was bought
    const nftOwner = await fakeNFTMarketplace.tokens(1)
    expect(nftOwner).to.be.equal(cryptoDevsDAO.address)

    const proposal = await cryptoDevsDAO.proposals(numProposal.value)
    expect(proposal.executed).to.be.equal(true)
  })

  it('Should not be able to execute executeProposal if doesnt have nft', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);
    const numProposal = await cryptoDevsDAO.createProposal(1)

    // 1 means NAY
    await cryptoDevsDAO.voteOnProposal(numProposal.value, 1)

    const SIX_MINUTES_IN_SECS = 6 * 60
    const votePeriodEnd = (await time.latest()) + SIX_MINUTES_IN_SECS;
    await time.increaseTo(votePeriodEnd);

    await expect(cryptoDevsDAO.connect(otherAccount).executeProposal(numProposal.value)).to.be.revertedWith("NOT_A_DAO_MEMBER");

  })

  it('Should not be able to execute executeProposal before deadline', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);
    const numProposal = await cryptoDevsDAO.createProposal(1)

    // 1 means NAY
    await cryptoDevsDAO.voteOnProposal(numProposal.value, 1)

    await expect(cryptoDevsDAO.executeProposal(numProposal.value)).to.be.revertedWith("DEADLINE_NOT_EXCEEDED");
  })

  it('Should not be able to execute executeProposal if it was already executed', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);
    const numProposal = await cryptoDevsDAO.createProposal(1)

    // 1 means NAY
    await cryptoDevsDAO.voteOnProposal(numProposal.value, 1)

    const SIX_MINUTES_IN_SECS = 6 * 60
    const votePeriodEnd = (await time.latest()) + SIX_MINUTES_IN_SECS;
    await time.increaseTo(votePeriodEnd);

    await cryptoDevsDAO.executeProposal(numProposal.value)

    await expect(cryptoDevsDAO.executeProposal(numProposal.value)).to.be.revertedWith("PROPOSAL_ALREADY_EXECUTED");
  })

  it('Should not be able to execute executeProposal where YAY wins but there are no funds', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);

    // we cannot use this cryptoDevsDAO contract because it was already deployed with 0.1 ether, so we need to create a new one

    const CryptoDevsDAO_NoFunds = await ethers.getContractFactory("CryptoDevsDAO");
    const cryptoDevsDAO_NoFunds = await CryptoDevsDAO_NoFunds.deploy(fakeNFTMarketplace.address, cryptoDevs.address);

    const numProposal = await cryptoDevsDAO_NoFunds.createProposal(1)

    // 0 means YAY
    await cryptoDevsDAO_NoFunds.voteOnProposal(numProposal.value, 0)

    const SIX_MINUTES_IN_SECS = 6 * 60
    const votePeriodEnd = (await time.latest()) + SIX_MINUTES_IN_SECS;
    await time.increaseTo(votePeriodEnd);

    await expect(cryptoDevsDAO_NoFunds.executeProposal(numProposal.value)).to.be.revertedWith("NOT_ENOUGH_FUNDS");
  })

})

describe("CryptoDevsDAO withdrawEther", function () {
  it('Should not be able to withdrawEther', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);

    const ownerBalanceBeforeWithdraw = await ethers.provider.getBalance(ownerWithNft.address);

    const transactionResponse = await cryptoDevsDAO.withdrawEther()

    // extract the gas cost of the withdraw transaction
    const transactionReceipt = await transactionResponse.wait()
    const { gasUsed, effectiveGasPrice } = transactionReceipt
    const gasCost = gasUsed.mul(effectiveGasPrice)

    const ownerBalanceAfterWidthdraw = await ethers.provider.getBalance(ownerWithNft.address);

    const finalOwnerBalanceMath = ownerBalanceBeforeWithdraw.add(ethers.utils.parseEther("0.1")).sub(gasCost)

    expect(ownerBalanceAfterWidthdraw).to.be.equal(finalOwnerBalanceMath)
  })

  it('Should not be able to withdraw if not the owner', async() => {
    const { cryptoDevsDAO, fakeNFTMarketplace, cryptoDevs, whitelist, ownerWithNft, otherAccount } = await loadFixture(deployCryptoDevsDAOandFakeMarketAndNftsAndWhitelist);

    await expect(cryptoDevsDAO.connect(otherAccount).withdrawEther()).to.be.revertedWith("Ownable: caller is not the owner");
  })

})