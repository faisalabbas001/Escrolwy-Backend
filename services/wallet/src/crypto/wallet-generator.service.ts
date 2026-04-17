import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import { EncryptionService } from './encryption.service';
import { WalletChainId } from '../config';

// Import TronWeb as CommonJS module
const TronWeb = require('tronweb');

/**
 * Generated Wallet Info
 */
export interface GeneratedWallet {
  chain: WalletChainId;
  address: string;
  publicKey: string | null;
  encryptedPrivateKey: string;
}

/**
 * Wallet Generator Service
 *
 * Generates custodial wallets for each supported chain:
 * - EVM: Uses ethers.js Wallet.createRandom()
 * - Solana: Uses @solana/web3.js Keypair.generate()
 * - Tron: Uses TronWeb.createAccount()
 */
@Injectable()
export class WalletGeneratorService {
  private readonly logger = new Logger(WalletGeneratorService.name);

  constructor(private readonly encryption: EncryptionService) {}

  /**
   * Generate wallets for all supported chains
   */
  async generateAllWallets(): Promise<GeneratedWallet[]> {
    const [evmWallet, solWallet, trcWallet] = await Promise.all([
      this.generateEvmWallet(),
      this.generateSolanaWallet(),
      this.generateTronWallet(),
    ]);

    return [evmWallet, solWallet, trcWallet];
  }

  /**
   * Generate an EVM wallet (Ethereum, BSC, Polygon)
   * The same wallet works across all EVM chains
   */
  async generateEvmWallet(): Promise<GeneratedWallet> {
    try {
      // Generate random wallet
      const wallet = ethers.Wallet.createRandom();

      // Encrypt the private key
      const encryptedPrivateKey = await this.encryption.encrypt(wallet.privateKey);

      this.logger.debug(`Generated EVM wallet: ${wallet.address}`);

      return {
        chain: 'evm',
        address: wallet.address,
        publicKey: wallet.publicKey,
        encryptedPrivateKey,
      };
    } catch (error) {
      this.logger.error('Failed to generate EVM wallet:', error);
      throw new Error('Failed to generate EVM wallet');
    }
  }

  /**
   * Generate a Solana wallet
   */
  async generateSolanaWallet(): Promise<GeneratedWallet> {
    try {
      // Generate random keypair
      const keypair = Keypair.generate();

      // Get the private key as base58 string
      const privateKeyBase58 = Buffer.from(keypair.secretKey).toString('base64');

      // Encrypt the private key
      const encryptedPrivateKey = await this.encryption.encrypt(privateKeyBase58);

      // Get public key as base58 string
      const publicKey = keypair.publicKey.toBase58();

      this.logger.debug(`Generated Solana wallet: ${publicKey}`);

      return {
        chain: 'sol',
        address: publicKey,
        publicKey,
        encryptedPrivateKey,
      };
    } catch (error) {
      this.logger.error('Failed to generate Solana wallet:', error);
      throw new Error('Failed to generate Solana wallet');
    }
  }

  /**
   * Generate a Tron wallet
   */
  async generateTronWallet(): Promise<GeneratedWallet> {
    try {
      // Create TronWeb instance (no network connection needed for account generation)
      const tronWeb = new TronWeb({
        fullHost: 'https://api.trongrid.io',
      });

      // Generate new account
      const account = await tronWeb.createAccount();

      // Encrypt the private key
      const encryptedPrivateKey = await this.encryption.encrypt(account.privateKey);

      this.logger.debug(`Generated Tron wallet: ${account.address.base58}`);

      return {
        chain: 'trc',
        address: account.address.base58,
        publicKey: account.publicKey,
        encryptedPrivateKey,
      };
    } catch (error) {
      this.logger.error('Failed to generate Tron wallet:', error);
      throw new Error('Failed to generate Tron wallet');
    }
  }

  /**
   * Recover EVM wallet from encrypted private key
   */
  async recoverEvmWallet(encryptedPrivateKey: string): Promise<ethers.Wallet> {
    const privateKey = await this.encryption.decrypt(encryptedPrivateKey);
    return new ethers.Wallet(privateKey);
  }

  /**
   * Recover Solana keypair from encrypted private key
   */
  async recoverSolanaKeypair(encryptedPrivateKey: string): Promise<Keypair> {
    const privateKeyBase58 = await this.encryption.decrypt(encryptedPrivateKey);
    const secretKey = Buffer.from(privateKeyBase58, 'base64');
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
  }

  /**
   * Recover Tron private key from encrypted private key
   */
  async recoverTronPrivateKey(encryptedPrivateKey: string): Promise<string> {
    return this.encryption.decrypt(encryptedPrivateKey);
  }
}

