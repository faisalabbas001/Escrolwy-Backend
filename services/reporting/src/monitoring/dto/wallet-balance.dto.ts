export interface TokenBalance {
    symbol: string;
    balance: string; // The API returns string for precision
    decimals: number;
}

export interface ChainBalance {
    chain: string;
    address: string;
    nativeBalance: string; // The API returns string for precision
    nativeSymbol: string;
    tokens?: TokenBalance[];
}

export interface WalletData {
    walletType: 'hot' | 'funding';
    chains: ChainBalance[];
}

export interface WalletBalanceResponse {
    hot: WalletData;
    funding: WalletData;
    fetchedAt: string;
}
