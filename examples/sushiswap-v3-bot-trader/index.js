require("dotenv").config();
const { ChainId } = require("sushi");
const { getSwap, getPrice } = require('sushi/evm');
const { ethers } = require("ethers");
const ABI_ERC20 = require("./abi.erc20.json");

const TOKEN0_ADDRESS = process.env.TOKEN0_ADDRESS;
const TOKEN1_ADDRESS = process.env.TOKEN1_ADDRESS;
const PRICE_TO_BUY = parseFloat(process.env.PRICE_TO_BUY);
const PROFITABILITY = parseFloat(process.env.PROFITABILITY);

async function monitor() {
    const price = await getPrice(ChainId.ETHEREUM, process.env.QUOTE0_ADDRESS);
    console.clear();
    console.log("Price: ", price);
    return price;
}

const provider = new ethers.InfuraProvider(process.env.NETWORK, process.env.INFURA_API_KEY);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const token0 = new ethers.Contract(TOKEN0_ADDRESS, ABI_ERC20, signer);
const token1 = new ethers.Contract(TOKEN1_ADDRESS, ABI_ERC20, signer);
const amountInWei = ethers.parseEther(process.env.AMOUNT_TO_BUY);

async function approve(tokenContract, amountInWei) {
    const tx = await tokenContract.approve(process.env.ROUTER_ADDRESS, amountInWei);
    console.log("Approving at " + tx.hash);
    await tx.wait();
    console.log("Approved!");
}

async function swap(tokenIn, tokenOut, amount) {
    const data = await getSwap({
        chainId: parseInt(process.env.CHAIN_ID),
        tokenIn,
        tokenOut,
        sender: process.env.WALLET,
        amount,
        maxSlippage: 0.005, // 0.05% max slippage
    });

    if (data.status !== 'Success')
        return console.error(data);

    const { tx, assumedAmountOut } = data;
    console.log(tx, assumedAmountOut);

    console.log(`Swapping ${tokenIn} > ${tokenOut}...`);
    const txResponse = await signer.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value ? ethers.toBigInt(tx.value) : undefined
    })

    console.log('Tx: ', txResponse.hash);

    const receipt = await txResponse.wait();
    console.log('Receipt: ', receipt);

    return assumedAmountOut;
}

let isOpened = false;
let isApproved = false;
let amountOut = 0;

async function cycle() {

    if (!isApproved) {
        await approve(token0, amountInWei);
        isApproved = true;
    }

    const price = await monitor();
    if (price <= PRICE_TO_BUY && !isOpened) {
        isOpened = true;
        amountOut = await swap(TOKEN0_ADDRESS, TOKEN1_ADDRESS, amountInWei);
        await approve(token1, amountOut);
    }
    else if (price >= (PRICE_TO_BUY * PROFITABILITY) && isOpened) {
        await swap(TOKEN1_ADDRESS, TOKEN0_ADDRESS, amountOut);
        isApproved = false;
        isOpened = false;
    }
    else
        console.log("Wait...");
    setTimeout(cycle, 10000);
}

cycle();