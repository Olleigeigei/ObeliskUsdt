import axios from 'axios';
import { fetchTransfersByWalletFromProviders } from '../src/services/blockScanner';

jest.mock('axios');

const mockedGet = axios.get as jest.Mock;

const address = 'TReceiverWalletAddress';
const trc20ContractAddress = 'TUsdtContractAddress';

function createParams() {
  return {
    address,
    tronGridBaseUrl: 'https://api.trongrid.example/',
    tronscanBaseUrl: 'https://api.tronscan.example/',
    trc20ContractAddress,
    startTimestamp: 1_700_000_000_000,
    endTimestamp: 1_700_001_200_000,
    limit: 200,
    tronGridApiKey: 'trongrid-key',
    tronscanApiKey: 'tronscan-key',
    logger: {
      warn: jest.fn(),
    },
  };
}

describe('blockScanner provider fallback', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('TronGrid 成功返回空数组时不回退 Tronscan', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [] } });
    const params = createParams();

    const transfers = await fetchTransfersByWalletFromProviders(params);

    expect(transfers).toEqual([]);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedGet).toHaveBeenCalledWith(
      `https://api.trongrid.example/v1/accounts/${encodeURIComponent(address)}/transactions/trc20`,
      expect.objectContaining({
        headers: { 'TRON-PRO-API-KEY': 'trongrid-key' },
      }),
    );
    expect(params.logger.warn).not.toHaveBeenCalled();
  });

  it('TronGrid 返回交易时使用 TronGrid Key 并规范化结果', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            transaction_id: 'grid-tx-1',
            token_info: { address: trc20ContractAddress },
            block_timestamp: 1_700_000_100_000,
            from: 'TSenderWalletAddress',
            to: address,
            value: '1234567',
          },
        ],
      },
    });
    const params = createParams();

    const transfers = await fetchTransfersByWalletFromProviders(params);

    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(transfers).toEqual([
      {
        txHash: 'grid-tx-1',
        fromAddress: 'TSenderWalletAddress',
        toAddress: address,
        amountSun: '1234567',
        amountUsdt: '1.2346',
        blockNumber: 0,
        blockTimestamp: 1_700_000_100_000,
      },
    ]);
  });

  it('仅在 TronGrid 失败时回退 Tronscan，并使用 Tronscan Key', async () => {
    mockedGet
      .mockRejectedValueOnce(new Error('TronGrid unavailable'))
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              hash: 'tronscan-tx-1',
              from: 'TSenderWalletAddress',
              to: address,
              amount: '2000000',
              block: 123456,
              block_timestamp: 1_700_000_200_000,
              contract_ret: 'SUCCESS',
            },
          ],
        },
      });
    const params = createParams();

    const transfers = await fetchTransfersByWalletFromProviders(params);

    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(mockedGet.mock.calls[0][1]).toEqual(
      expect.objectContaining({ headers: { 'TRON-PRO-API-KEY': 'trongrid-key' } }),
    );
    expect(mockedGet.mock.calls[1][0]).toBe('https://api.tronscan.example/api/transfer/trc20');
    expect(mockedGet.mock.calls[1][1]).toEqual(
      expect.objectContaining({ headers: { 'TRON-PRO-API-KEY': 'tronscan-key' } }),
    );
    expect(params.logger.warn).toHaveBeenCalledWith(
      '[ObeliskUSDT] TronGrid 查询失败，回退 Tronscan',
      expect.objectContaining({ address, error: expect.any(Error) }),
    );
    expect(transfers).toEqual([
      {
        txHash: 'tronscan-tx-1',
        fromAddress: 'TSenderWalletAddress',
        toAddress: address,
        amountSun: '2000000',
        amountUsdt: '2.0000',
        blockNumber: 123456,
        blockTimestamp: 1_700_000_200_000,
      },
    ]);
  });

  it('TronGrid 返回无效结构时回退 Tronscan', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [] } });
    const params = createParams();

    const transfers = await fetchTransfersByWalletFromProviders(params);

    expect(transfers).toEqual([]);
    expect(mockedGet).toHaveBeenCalledTimes(3);
    expect(params.logger.warn).toHaveBeenCalledTimes(1);
  });
});
