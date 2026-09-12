import { buildEnhancedQrImage } from '../src/services/qrImage';

describe('buildEnhancedQrImage', () => {
  it('使用当前 sharp 版本生成有效 PNG 二维码', async () => {
    const image = await buildEnhancedQrImage('tron:TReceiverWalletAddress?amount=1.2345', {
      topText: 'USDT-TRC20',
      bottomText: '1.2345 USDT',
      width: 320,
    });

    expect(Buffer.isBuffer(image)).toBe(true);
    expect(image.length).toBeGreaterThan(8);
    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });
});
