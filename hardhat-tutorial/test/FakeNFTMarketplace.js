const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

async function deployFakeNFTMarketplace() {
  const [owner, otherAccount] = await ethers.getSigners();

  const FakeNFTMarketplace = await ethers.getContractFactory("FakeNFTMarketplace");
  const fakeNFTMarketplace = await FakeNFTMarketplace.deploy();

  return { fakeNFTMarketplace, owner, otherAccount };
}

describe("FakeNFTMarketplace purchase", function () {
  it('Should be able to purchase', async() => {
    const { fakeNFTMarketplace, owner, otherAccount } = await loadFixture(deployFakeNFTMarketplace);
    
    await fakeNFTMarketplace.purchase(1, {
      value: ethers.utils.parseEther("0.1"),
    })

    const nftOwner = await fakeNFTMarketplace.tokens(1)
    expect(nftOwner).to.be.equal(owner.address)
  })

  it('Should not be able to purchase if price is different than transfer amount', async() => {
    const { fakeNFTMarketplace, owner, otherAccount } = await loadFixture(deployFakeNFTMarketplace);
    
    await expect(fakeNFTMarketplace.purchase(1, {value: ethers.utils.parseEther("0.01")})).to.be.revertedWith("This NFT costs 0.1 ether");
  })
})

describe("FakeNFTMarketplace available", function () {
  it('Should be able to show nft availability', async() => {
    const { fakeNFTMarketplace, owner, otherAccount } = await loadFixture(deployFakeNFTMarketplace);

    const availableBefore = await fakeNFTMarketplace.available(1)
    expect(availableBefore).to.be.equal(true)

    await fakeNFTMarketplace.purchase(1, {
      value: ethers.utils.parseEther("0.1"),
    })

    const availableAfter = await fakeNFTMarketplace.available(1)
    expect(availableAfter).to.be.equal(false)
  })
})